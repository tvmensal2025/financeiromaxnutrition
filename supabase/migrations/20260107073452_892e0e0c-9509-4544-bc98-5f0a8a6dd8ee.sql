-- Create conversation_tags table for labels
CREATE TABLE public.conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation_tag_assignments to link tags to conversations (by phone)
CREATE TABLE public.conversation_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.conversation_tags(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, tag_id, phone)
);

-- Create pinned_conversations table
CREATE TABLE public.pinned_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, phone)
);

-- Add assigned_to column to whatsapp_messages for agent assignment
ALTER TABLE public.whatsapp_messages ADD COLUMN assigned_to UUID REFERENCES public.profiles(id);

-- Enable RLS on all new tables
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_tags
CREATE POLICY "Users can view tags from their business" ON public.conversation_tags
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert tags to their business" ON public.conversation_tags
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update tags from their business" ON public.conversation_tags
  FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete tags from their business" ON public.conversation_tags
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS policies for conversation_tag_assignments
CREATE POLICY "Users can view tag assignments from their business" ON public.conversation_tag_assignments
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert tag assignments to their business" ON public.conversation_tag_assignments
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete tag assignments from their business" ON public.conversation_tag_assignments
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS policies for pinned_conversations
CREATE POLICY "Users can view pinned conversations from their business" ON public.pinned_conversations
  FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can insert pinned conversations to their business" ON public.pinned_conversations
  FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete pinned conversations from their business" ON public.pinned_conversations
  FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));