import { NextResponse } from "next/server";
import { checkSuperAdminCredentials, isSuperAdminConfigured } from "../../../../../lib/super-admin/auth";
import { createMobileSuperAdminToken } from "../../../../../lib/super-admin/mobile-auth";
export async function POST(req: Request) {
 if(!isSuperAdminConfigured()) return NextResponse.json({error:"Super Admin authentication is not configured."},{status:503});
 let body:{email?:string;password?:string};
 try{body=await req.json() as typeof body;}catch{return NextResponse.json({error:"Invalid request body."},{status:400});}
 if(!checkSuperAdminCredentials(body.email??"",body.password??"")) return NextResponse.json({error:"Invalid owner credentials."},{status:401});
 return NextResponse.json({accessToken:createMobileSuperAdminToken(),tokenType:"Bearer",expiresIn:3600,role:"super_admin"},{headers:{"Cache-Control":"no-store"}});
}