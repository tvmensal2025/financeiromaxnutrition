
-- Enum para status de leads
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'unqualified', 'converted');

-- Enum para temperatura do lead
CREATE TYPE public.lead_temperature AS ENUM ('cold', 'warm', 'hot');

-- Enum para estágios do pipeline
CREATE TYPE public.opportunity_stage AS ENUM ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');

-- Enum para status de agendamento
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- Enum para status de fatura
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'paid', 'overdue', 'cancelled');

-- Tabela de Leads
CREATE TABLE public.leads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    company TEXT,
    source TEXT,
    status lead_status NOT NULL DEFAULT 'new',
    temperature lead_temperature DEFAULT 'cold',
    notes TEXT,
    converted_customer_id UUID REFERENCES public.customers(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Oportunidades (Pipeline de Vendas)
CREATE TABLE public.opportunities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id),
    lead_id UUID REFERENCES public.leads(id),
    title TEXT NOT NULL,
    description TEXT,
    stage opportunity_stage NOT NULL DEFAULT 'prospecting',
    value NUMERIC NOT NULL DEFAULT 0,
    probability INTEGER DEFAULT 50,
    expected_close_date DATE,
    closed_at TIMESTAMP WITH TIME ZONE,
    lost_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Produtos
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    sku TEXT,
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Serviços
CREATE TABLE public.services (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Agendamentos
CREATE TABLE public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    service_id UUID REFERENCES public.services(id),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Faturas
CREATE TABLE public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    subscription_id UUID REFERENCES public.subscriptions(id),
    invoice_number TEXT NOT NULL,
    status invoice_status NOT NULL DEFAULT 'pending',
    subtotal NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Itens da Fatura
CREATE TABLE public.invoice_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    service_id UUID REFERENCES public.services(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Pagamentos
CREATE TABLE public.payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT,
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Leads
CREATE POLICY "Users can view leads from their business" ON public.leads FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert leads to their business" ON public.leads FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update leads from their business" ON public.leads FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete leads from their business" ON public.leads FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS Policies for Opportunities
CREATE POLICY "Users can view opportunities from their business" ON public.opportunities FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert opportunities to their business" ON public.opportunities FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update opportunities from their business" ON public.opportunities FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete opportunities from their business" ON public.opportunities FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS Policies for Products
CREATE POLICY "Users can view products from their business" ON public.products FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert products to their business" ON public.products FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update products from their business" ON public.products FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete products from their business" ON public.products FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS Policies for Services
CREATE POLICY "Users can view services from their business" ON public.services FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert services to their business" ON public.services FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update services from their business" ON public.services FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete services from their business" ON public.services FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS Policies for Appointments
CREATE POLICY "Users can view appointments from their business" ON public.appointments FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert appointments to their business" ON public.appointments FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update appointments from their business" ON public.appointments FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete appointments from their business" ON public.appointments FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS Policies for Invoices
CREATE POLICY "Users can view invoices from their business" ON public.invoices FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert invoices to their business" ON public.invoices FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update invoices from their business" ON public.invoices FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete invoices from their business" ON public.invoices FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS Policies for Invoice Items (based on invoice ownership)
CREATE POLICY "Users can view invoice items from their invoices" ON public.invoice_items FOR SELECT USING (invoice_id IN (SELECT id FROM invoices WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())));
CREATE POLICY "Users can insert invoice items to their invoices" ON public.invoice_items FOR INSERT WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())));
CREATE POLICY "Users can update invoice items from their invoices" ON public.invoice_items FOR UPDATE USING (invoice_id IN (SELECT id FROM invoices WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())));
CREATE POLICY "Users can delete invoice items from their invoices" ON public.invoice_items FOR DELETE USING (invoice_id IN (SELECT id FROM invoices WHERE business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid())));

-- RLS Policies for Payments
CREATE POLICY "Users can view payments from their business" ON public.payments FOR SELECT USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can insert payments to their business" ON public.payments FOR INSERT WITH CHECK (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can update payments from their business" ON public.payments FOR UPDATE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Users can delete payments from their business" ON public.payments FOR DELETE USING (business_id IN (SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
