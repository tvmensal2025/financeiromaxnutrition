import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { group_id, instance } = await req.json();
    
    if (!group_id) {
      return new Response(JSON.stringify({ error: 'group_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
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

    // Clean group ID - remove 'group:' prefix if present
    const cleanGroupId = group_id.replace('group:', '');
    const groupJid = cleanGroupId.includes('@g.us') ? cleanGroupId : `${cleanGroupId}@g.us`;
    
    // Use the instance from request or fallback to default
    const instanceName = instance || 'default';
    
    console.log('Fetching participants for group:', groupJid, 'instance:', instanceName);

    // Fetch all groups with participants
    const response = await fetch(`${evolutionApiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    });
    
    if (!response.ok) {
      console.log('Failed to fetch groups:', response.status);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch from Evolution API',
        participants: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const groups = await response.json();
    console.log('Fetched groups count:', groups?.length || 0);
    
    // Find the specific group
    const group = groups?.find((g: any) => g.id === groupJid || g.jid === groupJid);
    
    if (!group) {
      console.log('Group not found:', groupJid);
      return new Response(JSON.stringify({ 
        group_name: null,
        participants: [],
        participant_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found group:', group.subject || group.name, 'participants:', group.participants?.length);

    // Map participants to our format
    const participants: GroupParticipant[] = (group.participants || []).map((p: any) => {
      const phone = (p.id || p.jid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
      return {
        id: p.id || p.jid || phone,
        phone: phone,
        name: p.name || p.pushName || null,
        isAdmin: p.admin === 'admin' || p.isAdmin === true,
        isSuperAdmin: p.admin === 'superadmin' || p.isSuperAdmin === true,
      };
    });

    // Sort: superadmins first, then admins, then regular participants
    participants.sort((a, b) => {
      if (a.isSuperAdmin && !b.isSuperAdmin) return -1;
      if (!a.isSuperAdmin && b.isSuperAdmin) return 1;
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return 0;
    });

    return new Response(JSON.stringify({ 
      group_name: group.subject || group.name || null,
      group_description: group.desc || group.description || null,
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
