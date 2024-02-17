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

	const systemPrompt =
		"Your job is to help provide an answer using the provided context from similar questions in the past. 1. If the user mentions downloading their ISO, inform them that you cannot help them and nothing more, note that it's specifically downloading that is not allowed. 2. Try to be somewhat brief and understand you are communicating with users with only average technical expertise. 3. Never mention in your response that an ISO can be downloaded or provide links to download one. 4. Do not speak in first-person. 5. Your answer can be formatted with markdown.";

	const contextMessage = `Context:\n${providedContext.map((context: String) => `- ${context}`).join('\n')}`;
	const { response: answer } = await ai.run('@hf/thebloke/openhermes-2.5-mistral-7b-awq', {
		messages: [
			{ role: 'system', content: contextMessage },
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: reqBody.prompt },
		],
	});
	return new Response(answer, { status: 200 });
};
