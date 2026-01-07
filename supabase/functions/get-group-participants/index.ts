import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupParticipant {
  id: string;
  phone: string;
  name: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { group_id, business_id } = await req.json();
    
    if (!group_id) {
      return new Response(JSON.stringify({ error: 'group_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured');
      return new Response(JSON.stringify({ 
        error: 'Evolution API not configured',
        participants: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get instance name from business
    let instanceName = 'default';
    if (business_id) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: business } = await supabase
        .from('businesses')
        .select('evolution_instance')
        .eq('id', business_id)
        .single();
      
      if (business?.evolution_instance) {
        instanceName = business.evolution_instance;
      }
    }

    // Clean group ID - remove 'group:' prefix if present
    const cleanGroupId = group_id.replace('group:', '');
    const groupJid = cleanGroupId.includes('@g.us') ? cleanGroupId : `${cleanGroupId}@g.us`;
    
    console.log('Fetching participants for group:', groupJid, 'instance:', instanceName);

    // Try multiple endpoints
    let participants: GroupParticipant[] = [];
    let groupName: string | null = null;
    let groupDescription: string | null = null;

    // Method 1: Try findGroupInfos endpoint (more specific)
    try {
      console.log('Trying findGroupInfos endpoint...');
      const findResponse = await fetch(`${evolutionApiUrl}/group/findGroupInfos/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey
        },
        body: JSON.stringify({ groupJid })
      });
      
      if (findResponse.ok) {
        const groupInfo = await findResponse.json();
        console.log('findGroupInfos response:', JSON.stringify(groupInfo).substring(0, 500));
        
        if (groupInfo) {
          groupName = groupInfo.subject || groupInfo.name || null;
          groupDescription = groupInfo.desc || groupInfo.description || null;
          
          if (groupInfo.participants && Array.isArray(groupInfo.participants)) {
            participants = groupInfo.participants.map((p: any) => {
              const phone = (p.id || p.jid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
              return {
                id: p.id || p.jid || phone,
                phone: phone,
                name: p.name || p.pushName || null,
                isAdmin: p.admin === 'admin' || p.isAdmin === true,
                isSuperAdmin: p.admin === 'superadmin' || p.isSuperAdmin === true,
              };
            });
          }
        }
      } else {
        console.log('findGroupInfos failed:', findResponse.status);
      }
    } catch (e) {
      console.log('findGroupInfos error:', e);
    }

    // Method 2: Try fetchAllGroups if first method returned no participants
    if (participants.length === 0) {
      try {
        console.log('Trying fetchAllGroups endpoint...');
        const response = await fetch(`${evolutionApiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });
        
        if (response.ok) {
          const groups = await response.json();
          console.log('Fetched groups count:', groups?.length || 0);
          
          // Find the specific group
          const group = groups?.find((g: any) => g.id === groupJid || g.jid === groupJid);
          
          if (group) {
            console.log('Found group:', group.subject || group.name);
            groupName = group.subject || group.name || null;
            groupDescription = group.desc || group.description || null;
            
            if (group.participants && Array.isArray(group.participants)) {
              participants = group.participants.map((p: any) => {
                const phone = (p.id || p.jid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
                return {
                  id: p.id || p.jid || phone,
                  phone: phone,
                  name: p.name || p.pushName || null,
                  isAdmin: p.admin === 'admin' || p.isAdmin === true,
                  isSuperAdmin: p.admin === 'superadmin' || p.isSuperAdmin === true,
                };
              });
            }
          }
        } else {
          console.log('fetchAllGroups failed:', response.status);
        }
      } catch (e) {
        console.log('fetchAllGroups error:', e);
      }
    }

    // Method 3: Try participants endpoint directly
    if (participants.length === 0) {
      try {
        console.log('Trying participants endpoint...');
        const participantsResponse = await fetch(`${evolutionApiUrl}/group/participants/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          },
          body: JSON.stringify({ groupJid })
        });
        
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          console.log('Participants response:', JSON.stringify(participantsData).substring(0, 500));
          
          if (participantsData && Array.isArray(participantsData.participants || participantsData)) {
            const rawParticipants = participantsData.participants || participantsData;
            participants = rawParticipants.map((p: any) => {
              const phone = (p.id || p.jid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
              return {
                id: p.id || p.jid || phone,
                phone: phone,
                name: p.name || p.pushName || null,
                isAdmin: p.admin === 'admin' || p.isAdmin === true,
                isSuperAdmin: p.admin === 'superadmin' || p.isSuperAdmin === true,
              };
            });
          }
        } else {
          console.log('participants endpoint failed:', participantsResponse.status);
        }
      } catch (e) {
        console.log('participants error:', e);
      }
    }

    // Sort: superadmins first, then admins, then regular participants
    participants.sort((a, b) => {
      if (a.isSuperAdmin && !b.isSuperAdmin) return -1;
      if (!a.isSuperAdmin && b.isSuperAdmin) return 1;
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return 0;
    });

    console.log('Returning', participants.length, 'participants');

    return new Response(JSON.stringify({ 
      group_name: groupName,
      group_description: groupDescription,
      participants,
      participant_count: participants.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error fetching group participants:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage, participants: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});