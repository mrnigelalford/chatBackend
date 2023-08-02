var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { setDocument } from "./supabase";
import { Parser } from "htmlparser2";
import got from 'got';
export const crawlUrl = ({ url, baseUrl, data, currentDepth, maxDepth, spinner, }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    data.queue.delete(url);
    if (maxDepth === currentDepth)
        return;
    currentDepth += 1;
    try {
        const { headers, statusCode } = yield got.head(url);
        if (statusCode !== 200) {
            console.log(statusCode);
            data.errors.add(url);
            return;
        }
        if (!((_a = headers["content-type"]) === null || _a === void 0 ? void 0 : _a.includes("text/html"))) {
            return;
        }
        data.found.add(url);
        const { body } = yield got(url);
        const parser = new Parser({
            onopentag(name, attributes) {
                if (name === "a" && attributes.href) {
                    if (attributes.href.startsWith("#") ||
                        attributes.href.startsWith("mailto:") ||
                        attributes.href.startsWith("tel:") ||
                        attributes.href.startsWith("http")) {
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
            const searchSite = [...data.queue].map((url) => crawlUrl({ url, baseUrl, data, currentDepth, maxDepth, spinner }));
            yield Promise.all(searchSite);
        }
    }
    catch (error) {
        if (!error.message.includes("404")) {
            console.error(`Failed to load ${url}:\n${error.message}\n\n`);
        }
        else {
            data.errors.add(`404: ${url}`);
        }
    }
});
function isValidUrl(url) {
    const urlRegex = /^(?!.*(localhost|twitter|cloudflare)$)(https?:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/;
    return urlRegex.test(url);
}
const getSiteUrls = (siteUrl, maxDepth) => __awaiter(void 0, void 0, void 0, function* () {
    const rawData = {
        queue: new Set([siteUrl]),
        found: new Set([]),
        errors: new Set([]),
    };
    yield crawlUrl({
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
});
/**
 * Fetches all inner pages for the given top-level domain.
 * @async
 * @param {string} url - The URL of the web page to fetch data for.
 * @description This function returns an array containing all the collected inner page URLs.
 * @returns {Promise<string[]>} - An array containing inner page URLs.
 */
function getAllInnerPages(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const allPages = yield getSiteUrls(url, 2);
        if (allPages.found.length) {
            setDocument(allPages.found.map(u => ({ url: u })));
            return true;
        }
        return false;
    });
}
export default getAllInnerPages;
