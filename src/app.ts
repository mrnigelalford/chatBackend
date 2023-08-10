import express, { Request, Response } from "express";
import getAllInnerPages from "./crawler.js";
import { setEmbeddings } from "./setEmbeddings.js";
import getOpenAIStream from "./docs.js";


const app = express();
app.use(express.json());
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// works
app.post("/crawl", (req: Request, res: Response) => {
  getAllInnerPages(req.body.url, req.body.projectID);
  res.set('Content-Type', 'application/json').status(200).send({ note: 'Successfully started crawling operation. Please check additional endpoint for ongoing status or look in Supabase to see records returned. This endpoint will only start the crawling action.' })
});

app.post('/PageEmbeddings', (req: Request, res: Response) => {
  setEmbeddings(req.body.projectID.toLowerCase())
  res.set('Content-Type', 'application/json').status(200).send({ note: 'Successfully started embeddings. Please check additional endpoint for ongoing status or look in Supabase to see records returned. This endpoint will only start the crawling action.' })
})

app.get('/questions', async (req: Request, res: Response) => {
  const answer = await getOpenAIStream(req.body.question, req.body.projectID);
  res.set('Content-Type', 'application/json').status(200).send({ answer })
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
