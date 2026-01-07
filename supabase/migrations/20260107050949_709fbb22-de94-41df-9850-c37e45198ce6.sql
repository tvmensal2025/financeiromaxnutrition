-- Create message_templates table for storing reusable message templates
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their business templates" 
ON public.message_templates 
FOR SELECT 
USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create templates for their business" 
ON public.message_templates 
FOR INSERT 
WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their business templates" 
ON public.message_templates 
FOR UPDATE 
USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their business templates" 
ON public.message_templates 
FOR DELETE 
USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();