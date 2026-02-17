import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		if (!process.env.AUTH_SECRET) {
			return null;
		}
		const secureCookie = (process.env.AUTH_URL ?? '').startsWith('https');
		let token = null;
		try {
			token = await getToken({
				req: c.req.raw,
				secret: process.env.AUTH_SECRET,
				secureCookie,
			});
		} catch {
			return null;
		}
		if (token) {
			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp.toString(),
			};
		}
	};
	return {
		auth,
	};
}
