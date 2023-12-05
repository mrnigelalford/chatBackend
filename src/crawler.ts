import { setDocument } from "./supabase.js";
import { Parser } from "htmlparser2";
import got from 'got';


export const crawlUrl = async ({
	url,
	baseUrl,
	data,
	currentDepth,
	maxDepth,
	spinner,
}): Promise<void> => {
	data.queue.delete(url);

	if (maxDepth === currentDepth) return;

	currentDepth += 1;

	try {
		console.log('crawl: ', url);
		const { headers, statusCode } = await got.head(url);
		if (statusCode !== 200) {
			console.log(statusCode);
			data.errors.add(url);
			return;
		}

		if (!headers["content-type"]?.includes("text/html")) {
			return;
		}

		data.found.add(url);

		const { body } = await got(url);
		const parser = new Parser({
			onopentag(name: string, attributes: { href: string; }) {
				if (name === "a" && attributes.href) {
					if (
						attributes.href.startsWith("#") ||
						attributes.href.startsWith("mailto:") ||
						attributes.href.startsWith("tel:") ||
						attributes.href.startsWith("http")
					) {
						return;
					}

					const newUrl = attributes.href.startsWith("/")
						? (`${baseUrl}${attributes.href}`)
						: (`${url}/${attributes.href}`);

					if (!data.found.has(newUrl) && !data.errors.has(newUrl)) {
						data.queue.add(newUrl);
					}
				}
			},
		});
		parser.write(body);
		parser.end();

		if (data.queue.size > 0) {
			if (spinner) {
				spinner.text = `${data.found.size} Found, ${data.queue.size} Queued, ${data.errors.size} Errors`;
			}
			const searchSite = [...data.queue].map((url) =>
				crawlUrl({ url, baseUrl, data, currentDepth, maxDepth, spinner })
			);
			await Promise.all(searchSite);
		}
	} catch (error) {
		if (!error.message.includes("404")) {
			console.error(`Failed to load ${url}:\n${error.message}\n\n`);
		} else {
			data.errors.add(`404: ${url}`);
		}
	}
};

function isValidUrl(url: string): boolean {
	const urlRegex = /^(?!.*(localhost|twitter|cloudflare)$)(https?:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/
		;
	return urlRegex.test(url);
}

const getSiteUrls = async (siteUrl: string, maxDepth: number): Promise<{ found: string[], errors: string[] }> => {

	const rawData = {
		queue: new Set([siteUrl]),
		found: new Set([]),
		errors: new Set([]),
	};

	await crawlUrl({
		url: siteUrl,
		data: rawData,
		maxDepth,
		spinner: null,
		baseUrl: siteUrl,
		currentDepth: 0,
	});

	console.log('found length: ', [...new Set([...rawData.found].filter(u => isValidUrl(u)))].length);

	return {
		found: [...new Set([...rawData.found].filter(u => isValidUrl(u)))].sort(),
		errors: [...rawData.errors].sort(),
	};
};

/**
 * Fetches all inner pages for the given top-level domain.
 * @async
 * @param {string} url - The URL of the web page to fetch data for.
 * @description This function returns an array containing all the collected inner page URLs.
 * @returns {Promise<string[]>} - An array containing inner page URLs.
 */
async function getAllInnerPages(url: string, projectID: string): Promise<boolean> {
	console.log('starting: ', projectID, ' | ', url);
	console.time('crawl');
	const allPages = await getSiteUrls(url, 3);
	console.log('ap: ', allPages);
	if (allPages.found.length) {
		await setDocument(allPages.found.map(u => ({ url: u })), projectID);
		console.timeEnd('crawl');
		return true
	}
	return false
}

export default getAllInnerPages;
