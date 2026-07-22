const profileId = 'd0f12315-c1ce-4a03-8efe-c67452ec9ea2';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';
const baseUrl = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1';

async function testLoadUser() {
  // 1. Profile
  const resP = await fetch(`${baseUrl}/profiles?id=eq.${profileId}`, {
    headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
  });
  const profiles = await resP.json();
  console.log('Profile:', profiles[0]);

  // 2. User Roles
  const resUR = await fetch(`${baseUrl}/user_roles?user_id=eq.${profileId}&select=role_id,roles(id,nome,nivel)`, {
    headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
  });
  const userRoles = await resUR.json();
  console.log('User Roles:', JSON.stringify(userRoles, null, 2));

  // 3. User Direct Permissions
  const resUDP = await fetch(`${baseUrl}/user_direct_permissions?user_id=eq.${profileId}&select=permissions(pagina,acao)`, {
    headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
  });
  const userDirectPerms = await resUDP.json();
  console.log('User Direct Perms:', JSON.stringify(userDirectPerms, null, 2));
}

testLoadUser();
