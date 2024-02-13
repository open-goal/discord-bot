import { Ai } from '@cloudflare/ai';
import { Env } from '../..';
// import messages from '../../../vectorizeMessagesProcessing.json';
import { RequestLike } from 'itty-router';

export const BulkVectorizeQuestions = async (request: RequestLike, env: Env, ctx: ExecutionContext) => {
	// const ai = new Ai(env.AI);

	// for (const [id, text] of Object.entries(messages)) {
	// 	try {
	// 		const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [text] });
	// 		const values = data[0];
	// 		if (!values) {
	// 			console.error(`failed to vectorize ${id}`);
	// 			continue;
	// 		}
	// 		await env.VECTORIZE_INDEX.upsert([
	// 			{
	// 				id: id,
	// 				values,
	// 			},
	// 		]);
	// 	} catch (err) {
	// 		console.error(`failed to vectorize ${id}`);
	// 		console.error(err);
	// 	}
	// }
	return new Response(undefined, { status: 202 });
};

export const QueryForSimilarQuestions = async (request: Request, env: Env, ctx: ExecutionContext) => {
	const ai = new Ai(env.AI);
	const reqBody: any = await request.json();
	const question = reqBody.question;

	const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: question });

	const vectors = embeddings.data[0];

	const SIMILARITY_CUTOFF = 0.75;
	const vectorQuery = await env.VECTORIZE_INDEX.query(vectors, { topK: 3 });
	const vecIds = vectorQuery.matches.filter((vec) => vec.score > SIMILARITY_CUTOFF).map((vec) => vec.id);

	return new Response(JSON.stringify(vecIds), { status: 200 });
};

export const PromptWithContext = async (request: Request, env: Env, ctx: ExecutionContext) => {
	const ai = new Ai(env.AI);

	const reqBody: any = await request.json();
	const providedContext = reqBody.context;

	const systemPromptWithContext =
		'If the question mentions downloading their ISO, do not assist and inform them that a copy of the game must be obtained legitimately; note that the terms "dumping" and "ripping" are acceptable means to obtain the ISO.\nWhen answering the question use only the context provided to inform your response.\nTry to be brief and understand you are communicating with users that have only average technical expertise.\nNever mention in your response that an ISO can be downloaded or provide links to download one.\nDo not speak in first-person.\nYour answer can be formatted with markdown.';

	const systemPromptWithoutContext =
		'If the question mentions downloading their ISO, do not assist and inform them that a copy of the game must be obtained legitimately; note that the terms "dumping" and "ripping" are acceptable means to obtain the ISO.\nTell the user to wait for assistance from someone knowledgable on the project. If the question is about installing or running the game, refer them to our installation documentation https://opengoal.dev/docs/usage/installation/.\nDo not ask any follow-up questions or ask for any additional information.\nNever mention in your response that an ISO can be downloaded or provide links to download one.\nDo not speak in first-person.\nYour answer can be formatted with markdown.';

	if (providedContext.length > 0) {
		const contextMessage = `Context:\n${providedContext.map((context: String) => `- ${context}`).join('\n')}`;
		const { response: answer } = await ai.run('@hf/thebloke/openhermes-2.5-mistral-7b-awq', {
			messages: [
				{ role: 'system', content: contextMessage },
				{ role: 'system', content: systemPromptWithContext },
				{ role: 'user', content: reqBody.prompt },
			],
		});
		return new Response(answer, { status: 200 });
	} else {
		const { response: answer } = await ai.run('@hf/thebloke/openhermes-2.5-mistral-7b-awq', {
			messages: [
				{ role: 'system', content: systemPromptWithoutContext },
				{ role: 'user', content: reqBody.prompt },
			],
		});
		return new Response(answer, { status: 200 });
	}
};
