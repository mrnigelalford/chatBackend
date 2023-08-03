/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import * as fs from 'fs';

interface GitHubFile {
  name: string;
  path: string;
  download_url: string;
  content: string;
}

/*
github order of operations
  1. get ALL root files & folders endpoint
    https://api.github.com/repos/{{owner}}/{{repo}}/contents
    if(data.type === 'dir')
      // push return data into new collection [data.name]

  2. pass the name of each dir item to the recursive folder endpoint
    https://api.github.com/repos/{{owner}}/{{repo}}/contents/{{folder}}
  
    3. push return data into new collection
    { rawContent: data.download_url, fileName: data.name, public_reference: data._links.html}
    save the new collection to a json file. name is the [owner]-[repo-title].json

 */
const headers = {
  'Authorization': `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`,
  'User-Agent': 'MyApp',
};

export async function getALLRepos(owner: string): Promise<{ name: string, html_url: string, description: string, owner: string }[]> {
  const repos: { name: string, html_url: string, description: string, owner: string }[] = [];
  const { data } = await axios.get(`https://api.github.com/orgs/${owner}/repos`, {
    headers
  });
  if (Array.isArray(data)) {
    for (const item of data) {
      repos.push({
        name: item.name, html_url: item.html_url, description: item.description,
        owner: item.owner.login
      })
    }
  }
  fs.writeFileSync(`${owner}/${owner}-ALLrepos.json`, JSON.stringify(repos), 'utf-8');
  return repos
}

async function getAllRepoContents(owner: string, repo: string): Promise<{
  rawContent: any;
  fileName: any;
  public_reference: any;
}[]> {
  const apiRoot = `https://api.github.com/repos/${owner}/${repo}/contents`;

  let collection: { rawContent: string; fileName: string; public_reference: string; }[] = [];

  const getContent = async (url: string) => {
    try {
      const { data } = await axios.get(url, {
        headers
      });

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.type === 'dir') {
            await getContent(item.url);
          } else {
            collection.push({
              rawContent: item.download_url,
              fileName: item.name,
              public_reference: item._links.html,
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  await getContent(apiRoot);

  // Save the collection to a json file
  fs.writeFileSync(`${owner}/${owner}-${repo}.json`, JSON.stringify(collection), 'utf-8');
  return collection
}

export default getAllRepoContents;