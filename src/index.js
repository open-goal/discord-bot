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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let db = undefined;

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
	// await dumpAllSupportThreads(client);
  db = await AsyncDatabase.open('bot.db');
  await db.run('CREATE TABLE IF NOT EXISTS answers (id TEXT PRIMARY KEY, answers TEXT)');
  await db.run('CREATE TABLE IF NOT EXISTS waiting_to_be_vectorized (id TEXT PRIMARY KEY, question TEXT, answers TEXT)');
  await db.run('CREATE TABLE IF NOT EXISTS failed_to_vectorize (id TEXT PRIMARY KEY, question TEXT, answers TEXT)');
  // await upsertAllAnswers(db);
});

client.on(Events.ThreadCreate, async (thread) => {
  const threadAuthor = thread.ownerId;
  const threadMessages = await thread.messages.fetch({ limit: 100 });
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
  const questionEmbeddingsResp = await fetch("http://127.0.0.1:8787/llm/queryForSimilarQuestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: question }),
  });
  const questionEmbeddings = await questionEmbeddingsResp.json();
  console.log(`questionEmbeddings: ${questionEmbeddings}`);
  let context = [];
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
  }
  // Get the final response
  const response = await fetch("http://127.0.0.1:8787/llm/promptWithContext", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: question, context: context }),
  });
  let answer = await response.text();

  // If the answer was based on context, make that apparent
  if (questionEmbeddings.length > 0) {
    answer += "\n\n";
    answer += "_The above response was based on the following previous similar questions:_\n";
    for (const embedding of questionEmbeddings) {
      answer += `- https://discord.com/channels/756287461377703987/${embedding}\n`;
    }
  }

  answer += "\n\n_This is an automated response based on previously answered questions, there may be inaccuracies or statements that don't adhere to our rules (ie. obtaining ISOs)_\n\n"

  thread.send(answer);
});

client.on(Events.ThreadUpdate, async (thread) => {
  console.log("TODO - automatically store messages to be used for future training");
})

client.login(process.env.DISCORD_TOKEN);
