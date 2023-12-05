## Tasks

:green-check: Create service to handle starting web crawling
User can start and view crawl progress in the UI
Supported servcies:
  Github repo
  :green-check: Webpages
    :green-check: start crawl to discover all pages on a domain
    :green-check: take desired pages and pull content
[NEW] Adding Discord Support

# Workflow
1. Send POST request with base url
   1. This will store all findable URLs to supabase
2. Start Embeddings creation from webpages
   1. refer to table for all pages
      1. add column to timestamp last embedding creation
      2. This will store all embeddings for the given webpage
3. Deploy updated Next.js app
   1. points to supabase embeddings enpdoints
   2. supports building new embeddings whenever user talks
4. Deploy working project



## Front Ends
Potential react front-end: https://www.npmjs.com/package/react-chat-widget

Microsoft tool: https://github.com/microsoft/omnichannel-chat-widget


