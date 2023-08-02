import express from "express";
import getAllInnerPages from "./crawler.js";
const app = express();
app.use(express.json());
const port = 3000;
app.get('/', (req, res) => {
    res.send('Hello World!');
});
app.post("/crawl", (req, res) => {
    getAllInnerPages(req.body.url);
    res.set('Content-Type', 'application/json').status(200).send({ note: 'Successfully started crawling operation. Please check additional endpoint for ongoing status or look in Supabase to see records returned. This endpoint will only start the crawling action.' });
});
app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});
