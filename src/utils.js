import * as fs from 'fs';

export async function dumpAllSupportThreads(client) {
  const helpChannel = await client.channels.fetch("1019706639810580553");
	const activeThreads = await helpChannel.threads.fetchActive();
	const archivedThreads = [];
	const fetchAllArchivedThreads = async (before) => {
		const fetched = await helpChannel.threads.fetchArchived({
			type: 'public',
			before,
		});

		const last = fetched.threads.last();
		archivedThreads.push(...fetched.threads.values());

		if (
			!fetched.hasMore ||
			!last ||
			fetched.threads.size == 0
		)
			return;
		await fetchAllArchivedThreads(last.id);
	};
	await fetchAllArchivedThreads();
	console.log(activeThreads.threads.size + archivedThreads.length);

	let messageDump = {};

	let index = 0;
	for (let [threadId, thread] of activeThreads.threads) {
		console.log(`Exporting thread ${index++}...`);
		const messages = await thread.messages.fetch({ limit: 100 });
		const exportedMessages = [];
		for (let [messageId, message] of messages) {
			exportedMessages.push({
				author: message.author === undefined ? undefined : message.author.id,
				content: message.content
			})
		}
    exportedMessages.reverse();
		messageDump[threadId] = {
			name: thread.name,
			messages: exportedMessages,
      creator: thread.ownerId
		};
	}
	for (let thread of archivedThreads) {
		console.log(`Exporting thread ${index++}...`);
		const messages = await thread.messages.fetch({ limit: 100 });
		const exportedMessages = [];
		for (let [messageId, message] of messages) {
			exportedMessages.push({
				author: message.author === undefined ? undefined : message.author.id,
				content: message.content,
			})
		}
    exportedMessages.reverse();
		messageDump[thread.id] = {
			name: thread.name,
			messages: exportedMessages,
      creator: thread.ownerId
		};
	}

	// save to file
	fs.writeFileSync('./messageDump.json', JSON.stringify(messageDump));
}


export async function upsertAllAnswers(db) {
	const data = fs.readFileSync('answerMessages.json', 'utf8');
	const json = JSON.parse(data);

	for (const [id, answer] of Object.entries(json)) {
		console.log(`Upserting answer ${id}...`);
		await db.run("INSERT OR REPLACE INTO answers (id, answers) VALUES (?, ?)", [id, answer.trim()]);
	}
}
