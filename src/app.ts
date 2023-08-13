import express, { Request, Response } from "express";
import getAllInnerPages from "./crawler.js";
import { setEmbeddings } from "./setEmbeddings.js";
import getOpenAIStream from "./docs.js";
import basicAuth from 'express-basic-auth';


const app = express();

app.use(express.json());
app.use(basicAuth({
  users: { 'admin': process.env.DOCIT_AUTH }
}))
const port = process.env.PORT || 3000;

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
  return console.log(`App is listening listening at http://localhost:${port}`);
});
