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

/**
 * Fetches all repositories for a given GitHub organization.
 * @param {string} owner - The GitHub organization name.
 * @returns {Promise<{ name: string, html_url: string, description: string, owner: string }[]>} - An array of repository details.
 */
export async function getALLRepos(owner: string): Promise<{ name: string, html_url: string, description: string, owner: string }[]> {
  try {
    const repos: { name: string, html_url: string, description: string, owner: string }[] = [];
    const response = await fetch(`https://api.github.com/orgs/${owner}/repos`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories for organization ${owner}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      for (const item of data) {
        repos.push({
          name: item.name,
          html_url: item.html_url,
          description: item.description,
          owner: item.owner.login
        });
      }
    }

    fs.writeFileSync(`${owner}/${owner}-ALLrepos.json`, JSON.stringify(repos), 'utf-8');
    return repos;
  } catch (error) {
    console.error("Error while fetching repositories:", error);
    return [];
  }
}

/**
 * Fetches all contents of a GitHub repository, including nested directories and files.
 * @param {object} options - The options containing owner and repo details.
 * @param {string} options.owner - The GitHub organization or user name.
 * @param {string} options.repo - The repository name.
 * @returns {Promise<GitHubFile[]>} - An array of GitHubFile objects.
 */
async function getAllRepoContents({ owner, repo }: { owner: string, repo: string }): Promise<GitHubFile[]> {
  const apiRoot = `https://api.github.com/repos/${owner}/${repo}/contents`;

  const collection: GitHubFile[] = [];

  const getContent = async (url: string) => {
    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch contents for URL: ${url}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.type === 'dir') {
            await getContent(item.url);
          } else {
            collection.push({
              name: item.name,
              path: item.path,
              download_url: item.download_url,
              content: item.content
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  await getContent(apiRoot);

  // Save the collection to a json file
  fs.writeFileSync(`${owner}/${owner}-${repo}.json`, JSON.stringify(collection), 'utf-8');
  return collection;
}

export default getAllRepoContents;
