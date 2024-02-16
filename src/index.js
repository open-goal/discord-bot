import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { dumpAllSupportThreads, upsertAllAnswers } from './utils.js';
import { AsyncDatabase } from 'promised-sqlite3';

// TODO - it would be cool to boil down the users question into some search keywords
// search algolia - https://yap33bkrca-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=7d68c3181a134366b669225073fed1cb&x-algolia-application-id=YAP33BKRCA
// and then use that as another RAG source
// ```json
// {
//   "requests": [
//     {
//       "indexName": "open-goal",
//       "params": "query=installation steam deck how to"
//     }
//   ]
// }
// ```

// TODO - vectorize back to backend automatically

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
let db = undefined;

client.on(Events.ClientReady, async () => {
  try {
    console.log(`Logged in as ${client.user.tag}!`);
    // await dumpAllSupportThreads(client);
    db = await AsyncDatabase.open('bot.db');
    await db.run('CREATE TABLE IF NOT EXISTS answers (id TEXT PRIMARY KEY, answers TEXT)');
    await db.run('CREATE TABLE IF NOT EXISTS thread_tracking (id TEXT PRIMARY KEY, questions TEXT, answers TEXT, llm_responded INTEGER DEFAULT 0)');
    await db.run('CREATE TABLE IF NOT EXISTS failed_to_vectorize (id TEXT PRIMARY KEY, question TEXT, answers TEXT)');
    // await upsertAllAnswers(db);
    console.log(`Ready!`);
  } catch (e) {
    client.channels.cache.get("1206074512848986162").send(`Unexpected error in ready: ${e}`);
  }
});

async function llmRespondToThread(thread, threadAuthor, threadMessages) {
  let question = thread.name + ": ";
  for (const [messageId, message] of threadMessages) {
    if (message.author === threadAuthor) {
      question += message.content + "\n";
    }
  }
  // If the length of the question is greater than 500, then truncate it
  if (question.length > 500) {
    question = question.substring(0, 500);
  }
  // Vectorize the user's question to find similar questions in the past
  const questionEmbeddingsResp = await fetch("https://api.opengoal.dev/llm/queryForSimilarQuestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.OPENGOAL_API_KEY,
    },
    body: JSON.stringify({ question: question }),
  });
  const questionEmbeddings = await questionEmbeddingsResp.json();
  let context = [];
  let answer = "";
  if (questionEmbeddings.length > 0) {
    // Use that to form a prompt to try to solve the issue
    let embeddingList = "";
    for (const embedding of questionEmbeddings) {
      embeddingList += `'${embedding}', `;
    }
    embeddingList = embeddingList.substring(0, embeddingList.length - 2);
    const embeddings = await db.all(`SELECT * FROM answers WHERE id IN (${embeddingList})`);
    for (const embedding of embeddings) {
      context.push(embedding.answers);
    }
    // Get the final response
    const response = await fetch("https://api.opengoal.dev/llm/promptWithContext", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.OPENGOAL_API_KEY,
      },
      body: JSON.stringify({ prompt: question, context: context }),
    });
    answer = await response.text();
    answer += "\n\n";
    answer += "_The above response was based on the following previous similar questions:_\n";
    for (const embedding of questionEmbeddings) {
      answer += `- https://discord.com/channels/756287461377703987/${embedding}\n`;
    }
  } else {
    answer = "Your question does not seem to be similar to any questions in the past, so no automated help could be provided. Please wait for someone to respond when they are free.\n\nIf your question was related to issues with the game, you might find our installation documentation helpful https://opengoal.dev/docs/usage/installation/";
  }

  answer += "\n\n_This is an automated response and there may be inaccuracies or statements that don't adhere to our rules (ie. obtaining ISOs). Don't attempt to reply to this message, the bot will not respond._"

  thread.send(answer);
}

const trustedAnswerers = [
  "301711731628179457",
  "115998281317875714",
  "274327985425743873",
  "105216251676069888",
  "149603324671295488",
  "136657649209966592",
  "140194315518345216",
  "534921732608360449",
  "178908133475876865",
  "106039163333177344",
  "126398522361643008"
]

async function threadMessageHandler(message) {
  // Check if it's in the channel we care about
  const channelId = message.channel.parentId;
  if (channelId !== process.env.HELP_CHANNEL_ID || message.author.id === process.env.BOT_USER_ID) {
    return;
  }
  const threadId = message.channelId;
  const threadAuthorId = message.channel.ownerId;
  // grab all the messages and upsert them into the database
  const threadMessages = await message.channel.messages.fetch({ limit: 100 });
  // Check if we've done the LLM response yet
  const row = await db.get("SELECT * FROM thread_tracking WHERE id = ?", [threadId]);
  if (row === undefined || row.llm_responded === 0) {
    console.log("Responding to help thread!");
    // This is also a good spot to check for if the support package has been sent yet, if not
    // beg the user to provide it.
    let suppPackageReceived = false;
    for (const [messageId, message] of threadMessages) {
      if (message.author.id === threadAuthorId) {
        for (const [attachmentId, attachment] of message.attachments) {
          if (attachment.contentType === "application/zip") {
            suppPackageReceived = true;
            break;
          }
        }
      }
    }
    if (!suppPackageReceived) {
      message.channel.send("It does not seem like you have included your **support package**. The **support package** contains hardware info, logs, saves and settings that can help identify your issue.\n\nIt can be obtained via the launcher using these steps - https://www.youtube.com/watch?v=5nnl9Av09Zg\n\n_If your question is unrelated to installing or running the game, please ignore this._");
    }
    await llmRespondToThread(message.channel, threadAuthorId, threadMessages);
    if (row === undefined) {
      await db.run(`INSERT INTO thread_tracking (id, llm_responded) VALUES(?, ?)`, [threadId, 1]);
    } else {
      await db.run(`UPDATE thread_tracking SET llm_responded = ? WHERE id = ?`, [1, threadId]);
    }
  }
  let question = [];
  let answers = [];
  for (const [messageId, message] of threadMessages) {
    if (message.author.id === threadAuthorId) {
      question.push(message.content);
    } else if (trustedAnswerers.includes(message.author.id)) {
      answers.push(message.content);
    }
  }
  question.reverse();
  answers.reverse();
  await db.run("INSERT OR REPLACE INTO thread_tracking (id, questions, answers, llm_responded) VALUES (?, ?, ?, ?)", [threadId, JSON.stringify(question), JSON.stringify(answers), 1]);
  console.log("Upserted into thread_tracking - " + threadId);
}

client.on(Events.MessageCreate, async (message) => {
  try {
    await threadMessageHandler(message);
  } catch (e) {
    if (process.env.LOG_TO_SERVER === "true") {
      client.channels.cache.get("1206074512848986162").send(`Unexpected error in messageCreate: ${e}`);
    } else {
      console.error(e);
    }
  }
});

client.on(Events.MessageUpdate, async (message) => {
  try {
    await threadMessageHandler(message);
  } catch (e) {
    if (process.env.LOG_TO_SERVER === "true") {
      client.channels.cache.get("1206074512848986162").send(`Unexpected error in messageUpdate: ${e}`);
    } else {
      console.error(e);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
