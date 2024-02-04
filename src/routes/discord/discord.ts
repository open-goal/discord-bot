import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';
import { Env } from '../..';

export const DiscordHandler = async (request: any, env: Env, ctx: ExecutionContext) => {
	// Verify the request
	const signature = request.headers.get('X-Signature-Ed25519');
	const timestamp = request.headers.get('X-Signature-Timestamp');
	if (signature === null || timestamp === null) {
		return new Response('invalid request', { status: 401 });
	}
	const requestBody = await request.text();
	const isValidRequest = verifyKey(requestBody, signature, timestamp, env.DISCORD_PUBLIC_KEY.toString());
	if (!isValidRequest) {
		return new Response('invalid request signature', { status: 401 });
	}

	// Valid request, do something with it, maybe
	const data = JSON.parse(requestBody);
	const { type } = data;
	const headers = { 'Content-type': 'application/json' };

	if (type === InteractionType.PING) {
		return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), { headers });
	} else if (type === InteractionType.MODAL_SUBMIT) {
		// Not yet needed
	} else if (type === InteractionType.APPLICATION_COMMAND) {
		const commandName = data.data.name;
		if (commandName === 'help_support-package') {
			return new Response(
				JSON.stringify({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: `Please upload your support package, it contains:\n- Hardware info\n- Game logs\n- Game saves\n- Game Settings!\nhttps://www.youtube.com/watch?v=5nnl9Av09Zg`,
					},
				}),
				{ headers }
			);
		}
	}
};
