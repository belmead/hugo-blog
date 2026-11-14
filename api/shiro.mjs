import { createApp } from '../server.mjs';
let application;
export default async function handler(req,res) {
  application ||= createApp({production:true}).then(result=>result.app).catch(error=>{application=undefined;throw error;});
  const app=await application;
  return app(req,res);
}
