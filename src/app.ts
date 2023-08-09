import express, { Request, Response } from "express";
import getAllInnerPages from "./crawler.js";
import { setEmbeddings } from "./setEmbeddings.js";
import getOpenAIStream from "./docs.js";
import { InteractionResponseFlags, InteractionResponseType, InteractionType, verifyKeyMiddleware } from "discord-interactions";
import { getRandomEmoji } from "./discord/utls.js";
import { DiscordBody } from "./discord/Discord.types.js";
import bodyParser from "body-parser";


const app = express();
// Parse request body and verifies incoming requests using discord-interactions package
// app.use(express.json());

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

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/api/interactions', verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY), async function (req, res) {

  // Interaction type and data
  const { type, id, data }: DiscordBody = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    console.log('ing interaction', JSON.stringify(data))
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        // Fetches a random emoji to send from a helper function
        content: 'howdy ' + getRandomEmoji(),
      },
    });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */

  console.log('type: ', type );

  if(type === InteractionType.APPLICATION_COMMAND) {
    console.log('jsonApCommand: ', data);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Hello, you interacted with a component.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  if(type === InteractionType.MESSAGE_COMPONENT) {
    const { resolved } = data;
    console.log('hear: ', JSON.stringify(resolved));
  }
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    console.log('name: ', name);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        // Fetches a random emoji to send from a helper function
        content: 'hello world ' + getRandomEmoji(),
      },
    });

    // "test" command
    if (name === 'question') {
      console.log('heard');
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }
  }
});

app.use(bodyParser.json());

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
