import { createHmac, timingSafeEqual } from 'node:crypto';
const secret=process.env.SUPER_ADMIN_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? '';
export function createMobileSuperAdminToken():string {
 if(secret.length<32) throw new Error('Super Admin session secret is not configured');
 const payload=Buffer.from(JSON.stringify({role:'super_admin',exp:Date.now()+60*60*1000})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyMobileSuperAdminToken(token:string|undefined):boolean {
 if(!token||secret.length<32)return false;
 const [payload,signature]=token.split('.'); if(!payload||!signature)return false;
 const expected=Buffer.from(createHmac('sha256',secret).update(payload).digest('base64url')); const actual=Buffer.from(signature);
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return false;
 try {const d=JSON.parse(Buffer.from(payload,'base64url').toString()) as {role?:string;exp?:number};return d.role==='super_admin'&&typeof d.exp==='number'&&d.exp>Date.now();}catch{return false;}
}
export function bearerToken(req:Request):string|undefined {const h=req.headers.get('authorization')??'';return h.startsWith('Bearer ')?h.slice(7):undefined;}
