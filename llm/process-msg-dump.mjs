// read messageDump.json
import { readFileSync, writeFileSync } from 'fs';

const data = readFileSync('messageDump.json', 'utf8');
const json = JSON.parse(data);
let averageThreadTotal = 0;
let biggestThread = 0;
let smallestThread = 9999999;
let vectorizeMessages = {};
let answerMessages = {};

let trustedAnswerers = [
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

// reverse each entries 'messages' array
for (const [threadId, thread] of Object.entries(json)) {
  let words = thread.name.split(" ").length;
  for (const message of thread.messages) {
    words += message.content.split(" ").length;
  }
  averageThreadTotal += words;
  if (words > biggestThread) {
    biggestThread = words;
  }
  if (words < smallestThread) {
    smallestThread = words;
  }

  // Vectorize Portion (the author's context, the question)
  let question = thread.name + ": ";
  // - concat a maximum of 3 messages from the author (maybe they add further context near the beginning)
  let numMessagesAdded = 0;
  for (const message of thread.messages) {
    if (message.author === thread.creator && numMessagesAdded < 3) {
      question += message.content + "\n";
      numMessagesAdded++;
    }
  }
  // Answer portion (responses from trusted individuals, no more than 500 words)
  let answer = "";
  for (let i = thread.messages.length - 1; i > 0; i--) {
    const message = thread.messages[i];
    if (message.author !== thread.creator && trustedAnswerers.includes(message.author) && answer.split(" ").length < 500) {
      answer += message.content + "\n";
    }
  }
  if (answer !== "") {
    vectorizeMessages[threadId] = question;
    answerMessages[threadId] = answer;
  }
}
let averageThread = averageThreadTotal / Object.keys(json).length;
console.log(`averageThread: ${averageThread}`);
console.log(`biggestThread: ${biggestThread}`);
console.log(`smallestThread: ${smallestThread}`);

writeFileSync('vectorizeMessages.json', JSON.stringify(vectorizeMessages, undefined, 2));
writeFileSync('answerMessages.json', JSON.stringify(answerMessages, undefined, 2))
