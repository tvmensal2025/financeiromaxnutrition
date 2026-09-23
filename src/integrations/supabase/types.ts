export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acessos: {
        Row: {
          access_id: string
          atualizado_em: string
          concedido_em: string | null
          conta_workspace: string | null
          credential_reference: string | null
          criado_em: string
          linha_planilha: number | null
          observacoes: string | null
          papel: string | null
          pessoa_agente: string | null
          responsavel: string | null
          revogado_em: string | null
          sistema: string | null
          status: string | null
          tipo_acesso: string | null
        }
        Insert: {
          access_id: string
          atualizado_em?: string
          concedido_em?: string | null
          conta_workspace?: string | null
          credential_reference?: string | null
          criado_em?: string
          linha_planilha?: number | null
          observacoes?: string | null
          papel?: string | null
          pessoa_agente?: string | null
          responsavel?: string | null
          revogado_em?: string | null
          sistema?: string | null
          status?: string | null
          tipo_acesso?: string | null
        }
        Update: {
          access_id?: string
          atualizado_em?: string
          concedido_em?: string | null
          conta_workspace?: string | null
          credential_reference?: string | null
          criado_em?: string
          linha_planilha?: number | null
          observacoes?: string | null
          papel?: string | null
          pessoa_agente?: string | null
          responsavel?: string | null
          revogado_em?: string | null
          sistema?: string | null
          status?: string | null
          tipo_acesso?: string | null
        }
        Relationships: []
      }
      agentes: {
        Row: {
          agent_id: string
          agente: string | null
          atualizado_em: string
          cargo_funcao: string | null
          criado_em: string
          escalar_para: string | null
          estado_execucao: string | null
          ler_antes_de_responder: string | null
          linha_planilha: number | null
          missao: string | null
          numero: string | null
          pode_atualizar: string | null
          prompt_base: string | null
          quando_ativar: string | null
          saida_obrigatoria: string | null
          status: string | null
          ultima_atualizacao: string | null
          versao_prompt: string | null
        }
        Insert: {
          agent_id: string
          agente?: string | null
          atualizado_em?: string
          cargo_funcao?: string | null
          criado_em?: string
          escalar_para?: string | null
          estado_execucao?: string | null
          ler_antes_de_responder?: string | null
          linha_planilha?: number | null
          missao?: string | null
          numero?: string | null
          pode_atualizar?: string | null
          prompt_base?: string | null
          quando_ativar?: string | null
          saida_obrigatoria?: string | null
          status?: string | null
          ultima_atualizacao?: string | null
          versao_prompt?: string | null
        }
        Update: {
          agent_id?: string
          agente?: string | null
          atualizado_em?: string
          cargo_funcao?: string | null
          criado_em?: string
          escalar_para?: string | null
          estado_execucao?: string | null
          ler_antes_de_responder?: string | null
          linha_planilha?: number | null
          missao?: string | null
          numero?: string | null
          pode_atualizar?: string | null
          prompt_base?: string | null
          quando_ativar?: string | null
          saida_obrigatoria?: string | null
          status?: string | null
          ultima_atualizacao?: string | null
          versao_prompt?: string | null
        }
        Relationships: []
      }
      atendimento: {
        Row: {
          assunto: string | null
          atualizado_em: string
          business_id: string | null
          canal: string | null
          categoria: string | null
          causa_raiz: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          customer_id: string | null
          data_abertura: string | null
          descricao: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          prioridade: string | null
          produto_item_id: string | null
          recorrente: string | null
          related_object_id: string | null
          related_object_type: string | null
          resolucao: string | null
          resolvido_em: string | null
          responsavel: string | null
          sla_prazo: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          ticket_id: string
          updated_at: string | null
        }
        Insert: {
          assunto?: string | null
          atualizado_em?: string
          business_id?: string | null
          canal?: string | null
          categoria?: string | null
          causa_raiz?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_abertura?: string | null
          descricao?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          prioridade?: string | null
          produto_item_id?: string | null
          recorrente?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          resolucao?: string | null
          resolvido_em?: string | null
          responsavel?: string | null
          sla_prazo?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          ticket_id: string
          updated_at?: string | null
        }
        Update: {
          assunto?: string | null
          atualizado_em?: string
          business_id?: string | null
          canal?: string | null
          categoria?: string | null
          causa_raiz?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_abertura?: string | null
          descricao?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          prioridade?: string | null
          produto_item_id?: string | null
          recorrente?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          resolucao?: string | null
          resolvido_em?: string | null
          responsavel?: string | null
          sla_prazo?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          ticket_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ativos: {
        Row: {
          asset_id: string
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          custo: string | null
          data_aquisicao: string | null
          descricao: string | null
          documento_id: string | null
          entity_id: string | null
          external_id: string | null
          external_updated_at: string | null
          fornecedor_id: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          moeda: string | null
          nome: string | null
          observacoes: string | null
          related_object_id: string | null
          related_object_type: string | null
          renovacao_vencimento: string | null
          responsavel: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          updated_at: string | null
          url_referencia: string | null
        }
        Insert: {
          asset_id: string
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          custo?: string | null
          data_aquisicao?: string | null
          descricao?: string | null
          documento_id?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fornecedor_id?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          nome?: string | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          renovacao_vencimento?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          updated_at?: string | null
          url_referencia?: string | null
        }
        Update: {
          asset_id?: string
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          custo?: string | null
          data_aquisicao?: string | null
          descricao?: string | null
          documento_id?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fornecedor_id?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          nome?: string | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          renovacao_vencimento?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          updated_at?: string | null
          url_referencia?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string | null
          agente_usuario: string | null
          atualizado_em: string
          audit_id: string
          campo: string | null
          criado_em: string
          data_hora: string | null
          fonte_evidencia: string | null
          linha_planilha: number | null
          motivo: string | null
          object_id: string | null
          sensibilidade: string | null
          session_id: string | null
          sheet: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao?: string | null
          agente_usuario?: string | null
          atualizado_em?: string
          audit_id: string
          campo?: string | null
          criado_em?: string
          data_hora?: string | null
          fonte_evidencia?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          object_id?: string | null
          sensibilidade?: string | null
          session_id?: string | null
          sheet?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string | null
          agente_usuario?: string | null
          atualizado_em?: string
          audit_id?: string
          campo?: string | null
          criado_em?: string
          data_hora?: string | null
          fonte_evidencia?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          object_id?: string | null
          sensibilidade?: string | null
          session_id?: string | null
          sheet?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      auditoria_sistema: {
        Row: {
          area: string | null
          atualizado_em: string
          correcao_proxima_acao: string | null
          criado_em: string
          evidencia_metrica: string | null
          linha_planilha: number | null
          resultado: string | null
          resultado_anterior: string | null
          severidade: string | null
          test_id: string
          teste: string | null
          tipo_teste: string | null
          ultimo_teste: string | null
          versao_testada: string | null
        }
        Insert: {
          area?: string | null
          atualizado_em?: string
          correcao_proxima_acao?: string | null
          criado_em?: string
          evidencia_metrica?: string | null
          linha_planilha?: number | null
          resultado?: string | null
          resultado_anterior?: string | null
          severidade?: string | null
          test_id: string
          teste?: string | null
          tipo_teste?: string | null
          ultimo_teste?: string | null
          versao_testada?: string | null
        }
        Update: {
          area?: string | null
          atualizado_em?: string
          correcao_proxima_acao?: string | null
          criado_em?: string
          evidencia_metrica?: string | null
          linha_planilha?: number | null
          resultado?: string | null
          resultado_anterior?: string | null
          severidade?: string | null
          test_id?: string
          teste?: string | null
          tipo_teste?: string | null
          ultimo_teste?: string | null
          versao_testada?: string | null
        }
        Relationships: []
      }
      automacoes: {
        Row: {
          acao: string | null
          atualizado_em: string
          automation_id: string
          backoff_seconds: string | null
          business_id: string | null
          condicao: string | null
          conflict_policy: string | null
          criado_em: string
          dead_letter_policy: string | null
          erro_atual: string | null
          external_automation_id: string | null
          frequencia: string | null
          gatilho: string | null
          integration_id: string | null
          linha_planilha: number | null
          max_attempts: string | null
          nome: string | null
          observacoes: string | null
          proxima_execucao: string | null
          responsavel: string | null
          retryable_results: string | null
          source_sheet: string | null
          status: string | null
          target_sheet: string | null
          ultima_execucao: string | null
        }
        Insert: {
          acao?: string | null
          atualizado_em?: string
          automation_id: string
          backoff_seconds?: string | null
          business_id?: string | null
          condicao?: string | null
          conflict_policy?: string | null
          criado_em?: string
          dead_letter_policy?: string | null
          erro_atual?: string | null
          external_automation_id?: string | null
          frequencia?: string | null
          gatilho?: string | null
          integration_id?: string | null
          linha_planilha?: number | null
          max_attempts?: string | null
          nome?: string | null
          observacoes?: string | null
          proxima_execucao?: string | null
          responsavel?: string | null
          retryable_results?: string | null
          source_sheet?: string | null
          status?: string | null
          target_sheet?: string | null
          ultima_execucao?: string | null
        }
        Update: {
          acao?: string | null
          atualizado_em?: string
          automation_id?: string
          backoff_seconds?: string | null
          business_id?: string | null
          condicao?: string | null
          conflict_policy?: string | null
          criado_em?: string
          dead_letter_policy?: string | null
          erro_atual?: string | null
          external_automation_id?: string | null
          frequencia?: string | null
          gatilho?: string | null
          integration_id?: string | null
          linha_planilha?: number | null
          max_attempts?: string | null
          nome?: string | null
          observacoes?: string | null
          proxima_execucao?: string | null
          responsavel?: string | null
          retryable_results?: string | null
          source_sheet?: string | null
          status?: string | null
          target_sheet?: string | null
          ultima_execucao?: string | null
        }
        Relationships: []
      }
      backups: {
        Row: {
          arquivo_local: string | null
          atualizado_em: string
          backup_id: string
          criado_em: string
          criado_por: string | null
          data_hora: string | null
          hash_identificador: string | null
          linha_planilha: number | null
          motivo: string | null
          observacoes: string | null
          status: string | null
          versao_sistema: string | null
        }
        Insert: {
          arquivo_local?: string | null
          atualizado_em?: string
          backup_id: string
          criado_em?: string
          criado_por?: string | null
          data_hora?: string | null
          hash_identificador?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          observacoes?: string | null
          status?: string | null
          versao_sistema?: string | null
        }
        Update: {
          arquivo_local?: string | null
          atualizado_em?: string
          backup_id?: string
          criado_em?: string
          criado_por?: string | null
          data_hora?: string | null
          hash_identificador?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          observacoes?: string | null
          status?: string | null
          versao_sistema?: string | null
        }
        Relationships: []
      }
      calendario: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_evento: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          descricao: string | null
          dia_inteiro: string | null
          event_id: string
          execution_id: string | null
          external_id: string | null
          external_updated_at: string | null
          fim: string | null
          idempotency_key: string | null
          inicio: string | null
          integration_id: string | null
          last_sync: string | null
          lembrete_min: string | null
          linha_planilha: number | null
          observacoes: string | null
          occurrence_date: string | null
          participantes: string | null
          prioridade: string | null
          project_id: string | null
          recurrence_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          timezone: string | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_evento?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          descricao?: string | null
          dia_inteiro?: string | null
          event_id: string
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fim?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          last_sync?: string | null
          lembrete_min?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          occurrence_date?: string | null
          participantes?: string | null
          prioridade?: string | null
          project_id?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          timezone?: string | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_evento?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          descricao?: string | null
          dia_inteiro?: string | null
          event_id?: string
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fim?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          last_sync?: string | null
          lembrete_min?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          occurrence_date?: string | null
          participantes?: string | null
          prioridade?: string | null
          project_id?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          timezone?: string | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativacao: string | null
          atualizado_em: string
          business_id: string | null
          churn_em: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          customer_id: string
          data_entrada: string | null
          external_id: string | null
          external_updated_at: string | null
          feedback_principal: string | null
          health_score: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          motivo_churn: string | null
          mrr_brl: string | null
          nome: string | null
          nps_csat: string | null
          observacoes: string | null
          opportunity_id: string | null
          plano_produto: string | null
          proxima_acao: string | null
          related_object_id: string | null
          related_object_type: string | null
          renovacao: string | null
          responsavel_cs: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          ultimo_contato: string | null
          updated_at: string | null
        }
        Insert: {
          ativacao?: string | null
          atualizado_em?: string
          business_id?: string | null
          churn_em?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id: string
          data_entrada?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          feedback_principal?: string | null
          health_score?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          motivo_churn?: string | null
          mrr_brl?: string | null
          nome?: string | null
          nps_csat?: string | null
          observacoes?: string | null
          opportunity_id?: string | null
          plano_produto?: string | null
          proxima_acao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          renovacao?: string | null
          responsavel_cs?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
        }
        Update: {
          ativacao?: string | null
          atualizado_em?: string
          business_id?: string | null
          churn_em?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string
          data_entrada?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          feedback_principal?: string | null
          health_score?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          motivo_churn?: string | null
          mrr_brl?: string | null
          nome?: string | null
          nps_csat?: string | null
          observacoes?: string | null
          opportunity_id?: string | null
          plano_produto?: string | null
          proxima_acao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          renovacao?: string | null
          responsavel_cs?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comunicacoes: {
        Row: {
          acao_necessaria: string | null
          assunto: string | null
          atualizado_em: string
          business_id: string | null
          canal: string | null
          communication_id: string
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          customer_id: string | null
          data_hora: string | null
          destinatario: string | null
          direction: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          link_referencia: string | null
          observacoes: string | null
          opportunity_id: string | null
          pessoa_empresa: string | null
          prazo: string | null
          proxima_acao: string | null
          related_object_id: string | null
          related_object_type: string | null
          remetente: string | null
          responsavel: string | null
          resumo: string | null
          sensibilidade: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          thread_id: string | null
          updated_at: string | null
        }
        Insert: {
          acao_necessaria?: string | null
          assunto?: string | null
          atualizado_em?: string
          business_id?: string | null
          canal?: string | null
          communication_id: string
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_hora?: string | null
          destinatario?: string | null
          direction?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          link_referencia?: string | null
          observacoes?: string | null
          opportunity_id?: string | null
          pessoa_empresa?: string | null
          prazo?: string | null
          proxima_acao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          remetente?: string | null
          responsavel?: string | null
          resumo?: string | null
          sensibilidade?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          acao_necessaria?: string | null
          assunto?: string | null
          atualizado_em?: string
          business_id?: string | null
          canal?: string | null
          communication_id?: string
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_hora?: string | null
          destinatario?: string | null
          direction?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          link_referencia?: string | null
          observacoes?: string | null
          opportunity_id?: string | null
          pessoa_empresa?: string | null
          prazo?: string | null
          proxima_acao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          remetente?: string | null
          responsavel?: string | null
          resumo?: string | null
          sensibilidade?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracao: {
        Row: {
          atualizado_em: string
          chave: string | null
          criado_em: string
          descricao: string | null
          linha_planilha: number | null
          registro_id: number
          responsavel: string | null
          tipo: string | null
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          chave?: string | null
          criado_em?: string
          descricao?: string | null
          linha_planilha?: number | null
          registro_id?: never
          responsavel?: string | null
          tipo?: string | null
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          chave?: string | null
          criado_em?: string
          descricao?: string | null
          linha_planilha?: number | null
          registro_id?: never
          responsavel?: string | null
          tipo?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      consentimentos: {
        Row: {
          atualizado_em: string
          business_id: string | null
          canal_fonte: string | null
          concedido_em: string | null
          conferencia_integracao: string | null
          consent_id: string
          created_at: string | null
          criado_em: string
          documento_id: string | null
          evidencia: string | null
          expira_em: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          revogado_em: string | null
          source_system: string | null
          status: string | null
          subject_id: string | null
          sync_status: string | null
          tipo_purpose: string | null
          updated_at: string | null
          versao_termo: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          canal_fonte?: string | null
          concedido_em?: string | null
          conferencia_integracao?: string | null
          consent_id: string
          created_at?: string | null
          criado_em?: string
          documento_id?: string | null
          evidencia?: string | null
          expira_em?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          revogado_em?: string | null
          source_system?: string | null
          status?: string | null
          subject_id?: string | null
          sync_status?: string | null
          tipo_purpose?: string | null
          updated_at?: string | null
          versao_termo?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          canal_fonte?: string | null
          concedido_em?: string | null
          conferencia_integracao?: string | null
          consent_id?: string
          created_at?: string | null
          criado_em?: string
          documento_id?: string | null
          evidencia?: string | null
          expira_em?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          revogado_em?: string | null
          source_system?: string | null
          status?: string | null
          subject_id?: string | null
          sync_status?: string | null
          tipo_purpose?: string | null
          updated_at?: string | null
          versao_termo?: string | null
        }
        Relationships: []
      }
      contas_financeiras: {
        Row: {
          ativa: string | null
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          conta_id: string
          created_at: string | null
          criado_em: string
          data_saldo_inicial: string | null
          entity_id: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          instituicao: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          moeda: string | null
          movimentacao_liquidada: string | null
          nome: string | null
          observacoes: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          saldo_atual: string | null
          saldo_inicial: string | null
          source_system: string | null
          sync_status: string | null
          tipo: string | null
          ultima_conciliacao: string | null
          updated_at: string | null
        }
        Insert: {
          ativa?: string | null
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          conta_id: string
          created_at?: string | null
          criado_em?: string
          data_saldo_inicial?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          instituicao?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          movimentacao_liquidada?: string | null
          nome?: string | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          saldo_atual?: string | null
          saldo_inicial?: string | null
          source_system?: string | null
          sync_status?: string | null
          tipo?: string | null
          ultima_conciliacao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativa?: string | null
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          conta_id?: string
          created_at?: string | null
          criado_em?: string
          data_saldo_inicial?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          instituicao?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          movimentacao_liquidada?: string | null
          nome?: string | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          saldo_atual?: string | null
          saldo_inicial?: string | null
          source_system?: string | null
          sync_status?: string | null
          tipo?: string | null
          ultima_conciliacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          atualizado_em: string
          aviso_previo_dias: string | null
          business_id: string | null
          conferencia_integracao: string | null
          contract_id: string
          contraparte: string | null
          created_at: string | null
          criado_em: string
          customer_id: string | null
          data_assinatura: string | null
          data_obrigacao: string | null
          document_id: string | null
          entity_id: string | null
          external_id: string | null
          external_updated_at: string | null
          fim: string | null
          idempotency_key: string | null
          inicio: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          moeda: string | null
          objeto: string | null
          opportunity_id: string | null
          proxima_obrigacao: string | null
          recurrence_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          renovacao_automatica: string | null
          responsavel: string | null
          risco_observacoes: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          aviso_previo_dias?: string | null
          business_id?: string | null
          conferencia_integracao?: string | null
          contract_id: string
          contraparte?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_assinatura?: string | null
          data_obrigacao?: string | null
          document_id?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fim?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          objeto?: string | null
          opportunity_id?: string | null
          proxima_obrigacao?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          renovacao_automatica?: string | null
          responsavel?: string | null
          risco_observacoes?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          aviso_previo_dias?: string | null
          business_id?: string | null
          conferencia_integracao?: string | null
          contract_id?: string
          contraparte?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_assinatura?: string | null
          data_obrigacao?: string | null
          document_id?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fim?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          objeto?: string | null
          opportunity_id?: string | null
          proxima_obrigacao?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          renovacao_automatica?: string | null
          responsavel?: string | null
          risco_observacoes?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      crm: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_crm: string | null
          conferencia_integracao: string | null
          contato: string | null
          contract_id: string | null
          created_at: string | null
          criado_em: string
          customer_id: string | null
          data_proxima_acao: string | null
          email_telefone: string | null
          empresa_lead: string | null
          etapa: string | null
          external_id: string | null
          external_updated_at: string | null
          fechamento_previsto: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          moeda: string | null
          objecao: string | null
          observacoes: string | null
          opportunity_id: string
          origem: string | null
          probabilidade: string | null
          proxima_acao: string | null
          receita_recorrente: string | null
          recurrence_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          resultado: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          taxa_cambio_brl: string | null
          updated_at: string | null
          valor_potencial: string | null
          valor_potencial_brl: string | null
          valor_recorrente: string | null
          valor_recorrente_brl: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_crm?: string | null
          conferencia_integracao?: string | null
          contato?: string | null
          contract_id?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_proxima_acao?: string | null
          email_telefone?: string | null
          empresa_lead?: string | null
          etapa?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fechamento_previsto?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          objecao?: string | null
          observacoes?: string | null
          opportunity_id: string
          origem?: string | null
          probabilidade?: string | null
          proxima_acao?: string | null
          receita_recorrente?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          resultado?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          taxa_cambio_brl?: string | null
          updated_at?: string | null
          valor_potencial?: string | null
          valor_potencial_brl?: string | null
          valor_recorrente?: string | null
          valor_recorrente_brl?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_crm?: string | null
          conferencia_integracao?: string | null
          contato?: string | null
          contract_id?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          data_proxima_acao?: string | null
          email_telefone?: string | null
          empresa_lead?: string | null
          etapa?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fechamento_previsto?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          objecao?: string | null
          observacoes?: string | null
          opportunity_id?: string
          origem?: string | null
          probabilidade?: string | null
          proxima_acao?: string | null
          receita_recorrente?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          resultado?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          taxa_cambio_brl?: string | null
          updated_at?: string | null
          valor_potencial?: string | null
          valor_potencial_brl?: string | null
          valor_recorrente?: string | null
          valor_recorrente_brl?: string | null
        }
        Relationships: []
      }
      decisoes: {
        Row: {
          alternativas_consideradas: string | null
          atualizado_em: string
          business_id: string | null
          consultados: string | null
          criado_em: string
          data_hora: string | null
          decisao: string | null
          decision_id: string
          decisor: string | null
          escopo: string | null
          evidencia_fonte: string | null
          impacto_esperado: string | null
          linha_planilha: number | null
          motivo: string | null
          observacoes: string | null
          revisar_em: string | null
          status: string | null
          substitui_decision_id: string | null
          tipo: string | null
        }
        Insert: {
          alternativas_consideradas?: string | null
          atualizado_em?: string
          business_id?: string | null
          consultados?: string | null
          criado_em?: string
          data_hora?: string | null
          decisao?: string | null
          decision_id: string
          decisor?: string | null
          escopo?: string | null
          evidencia_fonte?: string | null
          impacto_esperado?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          observacoes?: string | null
          revisar_em?: string | null
          status?: string | null
          substitui_decision_id?: string | null
          tipo?: string | null
        }
        Update: {
          alternativas_consideradas?: string | null
          atualizado_em?: string
          business_id?: string | null
          consultados?: string | null
          criado_em?: string
          data_hora?: string | null
          decisao?: string | null
          decision_id?: string
          decisor?: string | null
          escopo?: string | null
          evidencia_fonte?: string | null
          impacto_esperado?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          observacoes?: string | null
          revisar_em?: string | null
          status?: string | null
          substitui_decision_id?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      dicionario_dados: {
        Row: {
          atualizado_em: string
          campo: string | null
          chave_fk: string | null
          criado_em: string
          descricao: string | null
          linha_planilha: number | null
          obrigatorio: string | null
          registro_id: number
          sensibilidade_padrao: string | null
          sheet: string | null
          tipo_logico: string | null
          unico: string | null
          valores_permitidos_fonte: string | null
        }
        Insert: {
          atualizado_em?: string
          campo?: string | null
          chave_fk?: string | null
          criado_em?: string
          descricao?: string | null
          linha_planilha?: number | null
          obrigatorio?: string | null
          registro_id?: never
          sensibilidade_padrao?: string | null
          sheet?: string | null
          tipo_logico?: string | null
          unico?: string | null
          valores_permitidos_fonte?: string | null
        }
        Update: {
          atualizado_em?: string
          campo?: string | null
          chave_fk?: string | null
          criado_em?: string
          descricao?: string | null
          linha_planilha?: number | null
          obrigatorio?: string | null
          registro_id?: never
          sensibilidade_padrao?: string | null
          sheet?: string | null
          tipo_logico?: string | null
          unico?: string | null
          valores_permitidos_fonte?: string | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          data_criacao: string | null
          descricao: string | null
          document_id: string
          drive_id: string | null
          entity_id: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          proxima_revisao: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          sensibilidade: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          titulo: string | null
          ultima_revisao: string | null
          updated_at: string | null
          url: string | null
          versao: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          data_criacao?: string | null
          descricao?: string | null
          document_id: string
          drive_id?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          proxima_revisao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          sensibilidade?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          titulo?: string | null
          ultima_revisao?: string | null
          updated_at?: string | null
          url?: string | null
          versao?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          data_criacao?: string | null
          descricao?: string | null
          document_id?: string
          drive_id?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          proxima_revisao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          sensibilidade?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          titulo?: string | null
          ultima_revisao?: string | null
          updated_at?: string | null
          url?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      dre_mensal: {
        Row: {
          atualizado_em: string
          business_id: string | null
          criado_em: string
          custos_diretos_brl: string | null
          despesas_operacionais_brl: string | null
          dre_id: string
          impostos_taxas_brl: string | null
          linha_planilha: number | null
          margem_bruta_brl: string | null
          observacoes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          receita_brl: string | null
          resultado_liquido_gerencial_brl: string | null
          resultado_operacional_brl: string | null
          status: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          criado_em?: string
          custos_diretos_brl?: string | null
          despesas_operacionais_brl?: string | null
          dre_id: string
          impostos_taxas_brl?: string | null
          linha_planilha?: number | null
          margem_bruta_brl?: string | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          receita_brl?: string | null
          resultado_liquido_gerencial_brl?: string | null
          resultado_operacional_brl?: string | null
          status?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          criado_em?: string
          custos_diretos_brl?: string | null
          despesas_operacionais_brl?: string | null
          dre_id?: string
          impostos_taxas_brl?: string | null
          linha_planilha?: number | null
          margem_bruta_brl?: string | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          receita_brl?: string | null
          resultado_liquido_gerencial_brl?: string | null
          resultado_operacional_brl?: string | null
          status?: string | null
        }
        Relationships: []
      }
      entidades: {
        Row: {
          atualizado_em: string
          business_id_relacionado: string | null
          cnpj_registro: string | null
          conferencia_integracao: string | null
          conta_contabil_base: string | null
          created_at: string | null
          criado_em: string
          entity_id: string
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          nome: string | null
          observacoes: string | null
          pais: string | null
          regime_tributario: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          uf_estado: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id_relacionado?: string | null
          cnpj_registro?: string | null
          conferencia_integracao?: string | null
          conta_contabil_base?: string | null
          created_at?: string | null
          criado_em?: string
          entity_id: string
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          nome?: string | null
          observacoes?: string | null
          pais?: string | null
          regime_tributario?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          uf_estado?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id_relacionado?: string | null
          cnpj_registro?: string | null
          conferencia_integracao?: string | null
          conta_contabil_base?: string | null
          created_at?: string | null
          criado_em?: string
          entity_id?: string
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          nome?: string | null
          observacoes?: string | null
          pais?: string | null
          regime_tributario?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          uf_estado?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      equipe: {
        Row: {
          agent_id: string
          atualizado_em: string
          criado_em: string
          funcao: string | null
          linha_planilha: number | null
          nome: string | null
          numero: string | null
          responsabilidade_principal: string | null
          status: string | null
        }
        Insert: {
          agent_id: string
          atualizado_em?: string
          criado_em?: string
          funcao?: string | null
          linha_planilha?: number | null
          nome?: string | null
          numero?: string | null
          responsabilidade_principal?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string
          atualizado_em?: string
          criado_em?: string
          funcao?: string | null
          linha_planilha?: number | null
          nome?: string | null
          numero?: string | null
          responsabilidade_principal?: string | null
          status?: string | null
        }
        Relationships: []
      }
      estado_mestre: {
        Row: {
          area: string | null
          atualizado_em: string
          confirmacao: string | null
          criado_em: string
          estado_atual: string | null
          fonte: string | null
          item: string | null
          linha_planilha: number | null
          proxima_acao: string | null
          registro_id: number
          related_id: string | null
          responsavel: string | null
          ultima_mudanca: string | null
        }
        Insert: {
          area?: string | null
          atualizado_em?: string
          confirmacao?: string | null
          criado_em?: string
          estado_atual?: string | null
          fonte?: string | null
          item?: string | null
          linha_planilha?: number | null
          proxima_acao?: string | null
          registro_id?: never
          related_id?: string | null
          responsavel?: string | null
          ultima_mudanca?: string | null
        }
        Update: {
          area?: string | null
          atualizado_em?: string
          confirmacao?: string | null
          criado_em?: string
          estado_atual?: string | null
          fonte?: string | null
          item?: string | null
          linha_planilha?: number | null
          proxima_acao?: string | null
          registro_id?: never
          related_id?: string | null
          responsavel?: string | null
          ultima_mudanca?: string | null
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          atualizado_em: string
          business_id: string | null
          categoria: string | null
          classe_dre: string | null
          competencia: string | null
          conferencia_do_lancamento: string | null
          conferencia_integracao: string | null
          conta_destino_id: string | null
          conta_id: string | null
          contract_id: string | null
          contraparte: string | null
          created_at: string | null
          criado_em: string
          customer_id: string | null
          descricao: string | null
          document_id: string | null
          entity_id: string | null
          evidencia: string | null
          execution_id: string | null
          external_id: string | null
          external_updated_at: string | null
          finance_id: string
          finance_id_origem: string | null
          fluxo: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          liquidacao: string | null
          moeda: string | null
          movimento_caixa_brl: string | null
          occurrence_date: string | null
          opportunity_id: string | null
          plano_conta_id: string | null
          project_id: string | null
          recurrence_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          saldo_aberto_brl: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          taxa_cambio: string | null
          tipo_ajuste: string | null
          updated_at: string | null
          valor_assinado_brl: string | null
          valor_brl: string | null
          valor_dre_brl: string | null
          valor_liquidado_informado_brl: string | null
          valor_original: string | null
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          categoria?: string | null
          classe_dre?: string | null
          competencia?: string | null
          conferencia_do_lancamento?: string | null
          conferencia_integracao?: string | null
          conta_destino_id?: string | null
          conta_id?: string | null
          contract_id?: string | null
          contraparte?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          descricao?: string | null
          document_id?: string | null
          entity_id?: string | null
          evidencia?: string | null
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          finance_id: string
          finance_id_origem?: string | null
          fluxo?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          liquidacao?: string | null
          moeda?: string | null
          movimento_caixa_brl?: string | null
          occurrence_date?: string | null
          opportunity_id?: string | null
          plano_conta_id?: string | null
          project_id?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          saldo_aberto_brl?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          taxa_cambio?: string | null
          tipo_ajuste?: string | null
          updated_at?: string | null
          valor_assinado_brl?: string | null
          valor_brl?: string | null
          valor_dre_brl?: string | null
          valor_liquidado_informado_brl?: string | null
          valor_original?: string | null
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          categoria?: string | null
          classe_dre?: string | null
          competencia?: string | null
          conferencia_do_lancamento?: string | null
          conferencia_integracao?: string | null
          conta_destino_id?: string | null
          conta_id?: string | null
          contract_id?: string | null
          contraparte?: string | null
          created_at?: string | null
          criado_em?: string
          customer_id?: string | null
          descricao?: string | null
          document_id?: string | null
          entity_id?: string | null
          evidencia?: string | null
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          finance_id?: string
          finance_id_origem?: string | null
          fluxo?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          liquidacao?: string | null
          moeda?: string | null
          movimento_caixa_brl?: string | null
          occurrence_date?: string | null
          opportunity_id?: string | null
          plano_conta_id?: string | null
          project_id?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          saldo_aberto_brl?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          taxa_cambio?: string | null
          tipo_ajuste?: string | null
          updated_at?: string | null
          valor_assinado_brl?: string | null
          valor_brl?: string | null
          valor_dre_brl?: string | null
          valor_liquidado_informado_brl?: string | null
          valor_original?: string | null
          vencimento?: string | null
        }
        Relationships: []
      }
      fluxo_caixa: {
        Row: {
          a_pagar_aberto_brl: string | null
          a_receber_aberto_brl: string | null
          atualizado_em: string
          business_id: string | null
          cashflow_id: string
          criado_em: string
          entradas_liquidadas_brl: string | null
          fluxo_liquido_brl: string | null
          linha_planilha: number | null
          observacoes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          responsavel: string | null
          saidas_liquidadas_brl: string | null
          status: string | null
        }
        Insert: {
          a_pagar_aberto_brl?: string | null
          a_receber_aberto_brl?: string | null
          atualizado_em?: string
          business_id?: string | null
          cashflow_id: string
          criado_em?: string
          entradas_liquidadas_brl?: string | null
          fluxo_liquido_brl?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          responsavel?: string | null
          saidas_liquidadas_brl?: string | null
          status?: string | null
        }
        Update: {
          a_pagar_aberto_brl?: string | null
          a_receber_aberto_brl?: string | null
          atualizado_em?: string
          business_id?: string | null
          cashflow_id?: string
          criado_em?: string
          entradas_liquidadas_brl?: string | null
          fluxo_liquido_brl?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          responsavel?: string | null
          saidas_liquidadas_brl?: string | null
          status?: string | null
        }
        Relationships: []
      }
      foco_executivo: {
        Row: {
          atualizado_em: string
          concluida_em: string | null
          criado_em: string
          criterio_de_saida: string | null
          escopo: string | null
          frente: string | null
          id: string
          iniciada_em: string | null
          linha_planilha: number | null
          motivo_prioridade: string | null
          objetivo: string | null
          observacoes: string | null
          ordem: string | null
          responsavel: string | null
          status: string | null
        }
        Insert: {
          atualizado_em?: string
          concluida_em?: string | null
          criado_em?: string
          criterio_de_saida?: string | null
          escopo?: string | null
          frente?: string | null
          id: string
          iniciada_em?: string | null
          linha_planilha?: number | null
          motivo_prioridade?: string | null
          objetivo?: string | null
          observacoes?: string | null
          ordem?: string | null
          responsavel?: string | null
          status?: string | null
        }
        Update: {
          atualizado_em?: string
          concluida_em?: string | null
          criado_em?: string
          criterio_de_saida?: string | null
          escopo?: string | null
          frente?: string | null
          id?: string
          iniciada_em?: string | null
          linha_planilha?: number | null
          motivo_prioridade?: string | null
          objetivo?: string | null
          observacoes?: string | null
          ordem?: string | null
          responsavel?: string | null
          status?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          atualizado_em: string
          business_id: string | null
          categoria: string | null
          conferencia_integracao: string | null
          contato: string | null
          contrato_id: string | null
          created_at: string | null
          criado_em: string
          custo_recorrente: string | null
          entity_id: string | null
          external_id: string | null
          external_updated_at: string | null
          fornecedor_parceiro: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          moeda: string | null
          observacoes: string | null
          periodicidade: string | null
          proximo_vencimento: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          risco: string | null
          source_system: string | null
          status: string | null
          supplier_id: string
          sync_status: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          categoria?: string | null
          conferencia_integracao?: string | null
          contato?: string | null
          contrato_id?: string | null
          created_at?: string | null
          criado_em?: string
          custo_recorrente?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fornecedor_parceiro?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          observacoes?: string | null
          periodicidade?: string | null
          proximo_vencimento?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco?: string | null
          source_system?: string | null
          status?: string | null
          supplier_id: string
          sync_status?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          categoria?: string | null
          conferencia_integracao?: string | null
          contato?: string | null
          contrato_id?: string | null
          created_at?: string | null
          criado_em?: string
          custo_recorrente?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          fornecedor_parceiro?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          observacoes?: string | null
          periodicidade?: string | null
          proximo_vencimento?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco?: string | null
          source_system?: string | null
          status?: string | null
          supplier_id?: string
          sync_status?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      fundador: {
        Row: {
          aprendizado: string | null
          area: string | null
          atualizado_em: string
          compromisso: string | null
          criado_em: string
          data: string | null
          evidencia: string | null
          exercicio: string | null
          linha_planilha: number | null
          padrao_objetivo: string | null
          proxima_pratica: string | null
          registro_id: number
          responsavel: string | null
          resultado: string | null
          sessao_id: string | null
          status: string | null
        }
        Insert: {
          aprendizado?: string | null
          area?: string | null
          atualizado_em?: string
          compromisso?: string | null
          criado_em?: string
          data?: string | null
          evidencia?: string | null
          exercicio?: string | null
          linha_planilha?: number | null
          padrao_objetivo?: string | null
          proxima_pratica?: string | null
          registro_id?: never
          responsavel?: string | null
          resultado?: string | null
          sessao_id?: string | null
          status?: string | null
        }
        Update: {
          aprendizado?: string | null
          area?: string | null
          atualizado_em?: string
          compromisso?: string | null
          criado_em?: string
          data?: string | null
          evidencia?: string | null
          exercicio?: string | null
          linha_planilha?: number | null
          padrao_objetivo?: string | null
          proxima_pratica?: string | null
          registro_id?: never
          responsavel?: string | null
          resultado?: string | null
          sessao_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      governanca: {
        Row: {
          atualizado_em: string
          cadencia: string | null
          calendar_event_id: string | null
          criado_em: string
          dia_hora: string | null
          dono: string | null
          entrega_esperada: string | null
          escopo: string | null
          governance_id: string
          linha_planilha: number | null
          observacoes: string | null
          participantes: string | null
          pauta_fixa: string | null
          proxima_realizacao: string | null
          recurrence_id: string | null
          ritual: string | null
          status: string | null
          ultima_realizacao: string | null
        }
        Insert: {
          atualizado_em?: string
          cadencia?: string | null
          calendar_event_id?: string | null
          criado_em?: string
          dia_hora?: string | null
          dono?: string | null
          entrega_esperada?: string | null
          escopo?: string | null
          governance_id: string
          linha_planilha?: number | null
          observacoes?: string | null
          participantes?: string | null
          pauta_fixa?: string | null
          proxima_realizacao?: string | null
          recurrence_id?: string | null
          ritual?: string | null
          status?: string | null
          ultima_realizacao?: string | null
        }
        Update: {
          atualizado_em?: string
          cadencia?: string | null
          calendar_event_id?: string | null
          criado_em?: string
          dia_hora?: string | null
          dono?: string | null
          entrega_esperada?: string | null
          escopo?: string | null
          governance_id?: string
          linha_planilha?: number | null
          observacoes?: string | null
          participantes?: string | null
          pauta_fixa?: string | null
          proxima_realizacao?: string | null
          recurrence_id?: string | null
          ritual?: string | null
          status?: string | null
          ultima_realizacao?: string | null
        }
        Relationships: []
      }
      guia_operacao: {
        Row: {
          atualizado_em: string
          criado_em: string
          linha_planilha: number | null
          o_que_fazer: string | null
          onde: string | null
          passo: string | null
          registro_id: number
          resultado: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          linha_planilha?: number | null
          o_que_fazer?: string | null
          onde?: string | null
          passo?: string | null
          registro_id?: never
          resultado?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          linha_planilha?: number | null
          o_que_fazer?: string | null
          onde?: string | null
          passo?: string | null
          registro_id?: never
          resultado?: string | null
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          assunto: string | null
          atualizado_em: string
          business_id_area: string | null
          contexto_essencial: string | null
          criado_em: string
          data_hora: string | null
          de: string | null
          id: string
          linha_planilha: number | null
          memoria_relacionada: string | null
          para: string | null
          pendencias: string | null
          pergunta_tarefa_transferida: string | null
          prazo: string | null
          prioridade: string | null
          related_object_id: string | null
          retorno_conclusao: string | null
          status: string | null
        }
        Insert: {
          assunto?: string | null
          atualizado_em?: string
          business_id_area?: string | null
          contexto_essencial?: string | null
          criado_em?: string
          data_hora?: string | null
          de?: string | null
          id: string
          linha_planilha?: number | null
          memoria_relacionada?: string | null
          para?: string | null
          pendencias?: string | null
          pergunta_tarefa_transferida?: string | null
          prazo?: string | null
          prioridade?: string | null
          related_object_id?: string | null
          retorno_conclusao?: string | null
          status?: string | null
        }
        Update: {
          assunto?: string | null
          atualizado_em?: string
          business_id_area?: string | null
          contexto_essencial?: string | null
          criado_em?: string
          data_hora?: string | null
          de?: string | null
          id?: string
          linha_planilha?: number | null
          memoria_relacionada?: string | null
          para?: string | null
          pendencias?: string | null
          pergunta_tarefa_transferida?: string | null
          prazo?: string | null
          prioridade?: string | null
          related_object_id?: string | null
          retorno_conclusao?: string | null
          status?: string | null
        }
        Relationships: []
      }
      helena_campos: {
        Row: {
          aba_planilha: string
          calculado: string
          chave: string
          coluna: string
          como_usar: string
          id: number
          nome_na_planilha: string
          tabela: string
        }
        Insert: {
          aba_planilha: string
          calculado: string
          chave: string
          coluna: string
          como_usar: string
          id?: never
          nome_na_planilha: string
          tabela: string
        }
        Update: {
          aba_planilha?: string
          calculado?: string
          chave?: string
          coluna?: string
          como_usar?: string
          id?: never
          nome_na_planilha?: string
          tabela?: string
        }
        Relationships: []
      }
      helena_guia: {
        Row: {
          assunto: string
          ordem: number
          regra: string
        }
        Insert: {
          assunto: string
          ordem: number
          regra: string
        }
        Update: {
          assunto?: string
          ordem?: number
          regra?: string
        }
        Relationships: []
      }
      ideias: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          custo_esforco: string | null
          data: string | null
          decisao: string | null
          external_id: string | null
          external_updated_at: string | null
          id: string
          ideia: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          motivo: string | null
          observacoes: string | null
          potencial: string | null
          related_object_id: string | null
          related_object_type: string | null
          resolve_gargalo_atual: string | null
          responsavel: string | null
          revisar_em: string | null
          source_system: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          custo_esforco?: string | null
          data?: string | null
          decisao?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          id: string
          ideia?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          observacoes?: string | null
          potencial?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          resolve_gargalo_atual?: string | null
          responsavel?: string | null
          revisar_em?: string | null
          source_system?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          custo_esforco?: string | null
          data?: string | null
          decisao?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          id?: string
          ideia?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          motivo?: string | null
          observacoes?: string | null
          potencial?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          resolve_gargalo_atual?: string | null
          responsavel?: string | null
          revisar_em?: string | null
          source_system?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      incidentes: {
        Row: {
          acao_imediata: string | null
          atualizado_em: string
          business_id: string | null
          causa_raiz: string | null
          conferencia_integracao: string | null
          correcao_definitiva: string | null
          created_at: string | null
          criado_em: string
          data_hora: string | null
          descricao: string | null
          documento_evidencia: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          impacto: string | null
          incident_id: string
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          related_object_id: string | null
          related_object_type: string | null
          resolvido_em: string | null
          responsavel: string | null
          risco_relacionado: string | null
          severidade: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          acao_imediata?: string | null
          atualizado_em?: string
          business_id?: string | null
          causa_raiz?: string | null
          conferencia_integracao?: string | null
          correcao_definitiva?: string | null
          created_at?: string | null
          criado_em?: string
          data_hora?: string | null
          descricao?: string | null
          documento_evidencia?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          impacto?: string | null
          incident_id: string
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          resolvido_em?: string | null
          responsavel?: string | null
          risco_relacionado?: string | null
          severidade?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          acao_imediata?: string | null
          atualizado_em?: string
          business_id?: string | null
          causa_raiz?: string | null
          conferencia_integracao?: string | null
          correcao_definitiva?: string | null
          created_at?: string | null
          criado_em?: string
          data_hora?: string | null
          descricao?: string | null
          documento_evidencia?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          impacto?: string | null
          incident_id?: string
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          resolvido_em?: string | null
          responsavel?: string | null
          risco_relacionado?: string | null
          severidade?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integracoes: {
        Row: {
          atualizado_em: string
          backoff_seconds: string | null
          business_id: string | null
          chave_externa: string | null
          chave_interna: string | null
          conflict_policy: string | null
          credential_reference: string | null
          criado_em: string
          direcao: string | null
          dono: string | null
          frequencia: string | null
          integration_id: string
          linha_planilha: number | null
          max_attempts: string | null
          objeto: string | null
          observacoes: string | null
          proxima_sync: string | null
          retry_politica: string | null
          sistema: string | null
          source_sheet: string | null
          source_system: string | null
          status: string | null
          ultima_sync: string | null
          ultimo_erro: string | null
        }
        Insert: {
          atualizado_em?: string
          backoff_seconds?: string | null
          business_id?: string | null
          chave_externa?: string | null
          chave_interna?: string | null
          conflict_policy?: string | null
          credential_reference?: string | null
          criado_em?: string
          direcao?: string | null
          dono?: string | null
          frequencia?: string | null
          integration_id: string
          linha_planilha?: number | null
          max_attempts?: string | null
          objeto?: string | null
          observacoes?: string | null
          proxima_sync?: string | null
          retry_politica?: string | null
          sistema?: string | null
          source_sheet?: string | null
          source_system?: string | null
          status?: string | null
          ultima_sync?: string | null
          ultimo_erro?: string | null
        }
        Update: {
          atualizado_em?: string
          backoff_seconds?: string | null
          business_id?: string | null
          chave_externa?: string | null
          chave_interna?: string | null
          conflict_policy?: string | null
          credential_reference?: string | null
          criado_em?: string
          direcao?: string | null
          dono?: string | null
          frequencia?: string | null
          integration_id?: string
          linha_planilha?: number | null
          max_attempts?: string | null
          objeto?: string | null
          observacoes?: string | null
          proxima_sync?: string | null
          retry_politica?: string | null
          sistema?: string | null
          source_sheet?: string | null
          source_system?: string | null
          status?: string | null
          ultima_sync?: string | null
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      listas_dominio: {
        Row: {
          id: number
          lista: string
          ordem: number | null
          valor: string
        }
        Insert: {
          id?: never
          lista: string
          ordem?: number | null
          valor: string
        }
        Update: {
          id?: never
          lista?: string
          ordem?: number | null
          valor?: string
        }
        Relationships: []
      }
      marcos: {
        Row: {
          atualizado_em: string
          business_id: string | null
          concluido_em: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          criterio_de_aceite: string | null
          descricao: string | null
          evidencia: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          marco: string | null
          milestone_id: string
          observacoes: string | null
          prazo: string | null
          project_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          concluido_em?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          criterio_de_aceite?: string | null
          descricao?: string | null
          evidencia?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          marco?: string | null
          milestone_id: string
          observacoes?: string | null
          prazo?: string | null
          project_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          concluido_em?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          criterio_de_aceite?: string | null
          descricao?: string | null
          evidencia?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          marco?: string | null
          milestone_id?: string
          observacoes?: string | null
          prazo?: string | null
          project_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      marketing: {
        Row: {
          alcance: string | null
          atualizado_em: string
          audiencia: string | null
          business_id: string | null
          cac: string | null
          campaign_id: string
          campanha_experimento: string | null
          canal: string | null
          conferencia_integracao: string | null
          conversoes: string | null
          created_at: string | null
          criado_em: string
          external_id: string | null
          external_updated_at: string | null
          fim: string | null
          hipotese: string | null
          idempotency_key: string | null
          inicio: string | null
          integration_id: string | null
          investimento_brl: string | null
          last_sync: string | null
          leads: string | null
          linha_planilha: number | null
          observacoes: string | null
          oferta_mensagem: string | null
          receita_atribuida_brl: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          roas: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          alcance?: string | null
          atualizado_em?: string
          audiencia?: string | null
          business_id?: string | null
          cac?: string | null
          campaign_id: string
          campanha_experimento?: string | null
          canal?: string | null
          conferencia_integracao?: string | null
          conversoes?: string | null
          created_at?: string | null
          criado_em?: string
          external_id?: string | null
          external_updated_at?: string | null
          fim?: string | null
          hipotese?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          investimento_brl?: string | null
          last_sync?: string | null
          leads?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          oferta_mensagem?: string | null
          receita_atribuida_brl?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          roas?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          alcance?: string | null
          atualizado_em?: string
          audiencia?: string | null
          business_id?: string | null
          cac?: string | null
          campaign_id?: string
          campanha_experimento?: string | null
          canal?: string | null
          conferencia_integracao?: string | null
          conversoes?: string | null
          created_at?: string | null
          criado_em?: string
          external_id?: string | null
          external_updated_at?: string | null
          fim?: string | null
          hipotese?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          investimento_brl?: string | null
          last_sync?: string | null
          leads?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          oferta_mensagem?: string | null
          receita_atribuida_brl?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          roas?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      memoria_mestre: {
        Row: {
          agente_origem: string | null
          assunto: string | null
          atualizado_em: string
          business_id_area: string | null
          confianca: string | null
          criado_em: string
          data_hora: string | null
          evidencia_origem: string | null
          id: string
          linha_planilha: number | null
          proxima_acao: string | null
          registro: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          sensibilidade: string | null
          session_id: string | null
          status: string | null
          substitui_id: string | null
          tipo: string | null
        }
        Insert: {
          agente_origem?: string | null
          assunto?: string | null
          atualizado_em?: string
          business_id_area?: string | null
          confianca?: string | null
          criado_em?: string
          data_hora?: string | null
          evidencia_origem?: string | null
          id: string
          linha_planilha?: number | null
          proxima_acao?: string | null
          registro?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          sensibilidade?: string | null
          session_id?: string | null
          status?: string | null
          substitui_id?: string | null
          tipo?: string | null
        }
        Update: {
          agente_origem?: string | null
          assunto?: string | null
          atualizado_em?: string
          business_id_area?: string | null
          confianca?: string | null
          criado_em?: string
          data_hora?: string | null
          evidencia_origem?: string | null
          id?: string
          linha_planilha?: number | null
          proxima_acao?: string | null
          registro?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          sensibilidade?: string | null
          session_id?: string | null
          status?: string | null
          substitui_id?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      metas_kpis: {
        Row: {
          area: string | null
          atualizado_em: string
          baseline: string | null
          business_id: string | null
          criado_em: string
          data_ultimo_valor: string | null
          definicao: string | null
          escopo: string | null
          formula_fonte: string | null
          kpi: string | null
          kpi_id: string
          linha_planilha: number | null
          meta: string | null
          observacoes: string | null
          periodicidade: string | null
          responsavel: string | null
          status: string | null
          ultimo_valor: string | null
          unidade: string | null
        }
        Insert: {
          area?: string | null
          atualizado_em?: string
          baseline?: string | null
          business_id?: string | null
          criado_em?: string
          data_ultimo_valor?: string | null
          definicao?: string | null
          escopo?: string | null
          formula_fonte?: string | null
          kpi?: string | null
          kpi_id: string
          linha_planilha?: number | null
          meta?: string | null
          observacoes?: string | null
          periodicidade?: string | null
          responsavel?: string | null
          status?: string | null
          ultimo_valor?: string | null
          unidade?: string | null
        }
        Update: {
          area?: string | null
          atualizado_em?: string
          baseline?: string | null
          business_id?: string | null
          criado_em?: string
          data_ultimo_valor?: string | null
          definicao?: string | null
          escopo?: string | null
          formula_fonte?: string | null
          kpi?: string | null
          kpi_id?: string
          linha_planilha?: number | null
          meta?: string | null
          observacoes?: string | null
          periodicidade?: string | null
          responsavel?: string | null
          status?: string | null
          ultimo_valor?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      obrigacoes: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          contract_id: string | null
          created_at: string | null
          criado_em: string
          descricao: string | null
          entity_id: string | null
          event_id: string | null
          evidencia: string | null
          execution_id: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          obligation_id: string
          observacoes: string | null
          occurrence_date: string | null
          origem: string | null
          prazo: string | null
          recurrence_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          risco_de_atraso: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          contract_id?: string | null
          created_at?: string | null
          criado_em?: string
          descricao?: string | null
          entity_id?: string | null
          event_id?: string | null
          evidencia?: string | null
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          obligation_id: string
          observacoes?: string | null
          occurrence_date?: string | null
          origem?: string | null
          prazo?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco_de_atraso?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          contract_id?: string | null
          created_at?: string | null
          criado_em?: string
          descricao?: string | null
          entity_id?: string | null
          event_id?: string | null
          evidencia?: string | null
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          obligation_id?: string
          observacoes?: string | null
          occurrence_date?: string | null
          origem?: string | null
          prazo?: string | null
          recurrence_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco_de_atraso?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orcamento: {
        Row: {
          atualizado_em: string
          budget_id: string
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          desvio: string | null
          desvio_brl: string | null
          entity_id: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          plano_conta_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          updated_at: string | null
          valor_orcado_brl: string | null
          valor_realizado_brl: string | null
        }
        Insert: {
          atualizado_em?: string
          budget_id: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          desvio?: string | null
          desvio_brl?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          plano_conta_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
          valor_orcado_brl?: string | null
          valor_realizado_brl?: string | null
        }
        Update: {
          atualizado_em?: string
          budget_id?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          desvio?: string | null
          desvio_brl?: string | null
          entity_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          plano_conta_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          updated_at?: string | null
          valor_orcado_brl?: string | null
          valor_realizado_brl?: string | null
        }
        Relationships: []
      }
      pessoas: {
        Row: {
          acesso_necessario: string | null
          area: string | null
          atualizado_em: string
          contrato_id: string | null
          criado_em: string
          custo_mensal_brl: string | null
          data_fim: string | null
          data_inicio: string | null
          entity_id: string | null
          funcao: string | null
          gestor: string | null
          linha_planilha: number | null
          nome: string | null
          observacoes: string | null
          performance_objetivo: string | null
          person_id: string
          status: string | null
          tipo: string | null
        }
        Insert: {
          acesso_necessario?: string | null
          area?: string | null
          atualizado_em?: string
          contrato_id?: string | null
          criado_em?: string
          custo_mensal_brl?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          entity_id?: string | null
          funcao?: string | null
          gestor?: string | null
          linha_planilha?: number | null
          nome?: string | null
          observacoes?: string | null
          performance_objetivo?: string | null
          person_id: string
          status?: string | null
          tipo?: string | null
        }
        Update: {
          acesso_necessario?: string | null
          area?: string | null
          atualizado_em?: string
          contrato_id?: string | null
          criado_em?: string
          custo_mensal_brl?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          entity_id?: string | null
          funcao?: string | null
          gestor?: string | null
          linha_planilha?: number | null
          nome?: string | null
          observacoes?: string | null
          performance_objetivo?: string | null
          person_id?: string
          status?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      plano_contas: {
        Row: {
          ativo: string | null
          atualizado_em: string
          classe_dre: string | null
          codigo: string | null
          criado_em: string
          descricao: string | null
          fluxo_esperado: string | null
          linha_planilha: number | null
          nome: string | null
          operacional: string | null
          ordem: string | null
          plano_conta_id: string
        }
        Insert: {
          ativo?: string | null
          atualizado_em?: string
          classe_dre?: string | null
          codigo?: string | null
          criado_em?: string
          descricao?: string | null
          fluxo_esperado?: string | null
          linha_planilha?: number | null
          nome?: string | null
          operacional?: string | null
          ordem?: string | null
          plano_conta_id: string
        }
        Update: {
          ativo?: string | null
          atualizado_em?: string
          classe_dre?: string | null
          codigo?: string | null
          criado_em?: string
          descricao?: string | null
          fluxo_esperado?: string | null
          linha_planilha?: number | null
          nome?: string | null
          operacional?: string | null
          ordem?: string | null
          plano_conta_id?: string
        }
        Relationships: []
      }
      portfolio: {
        Row: {
          ativo: string | null
          atualizado_em: string
          business_id: string
          caixa: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          definicao_de_saida_do_estagio: string | null
          entity_id: string | null
          estagio: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          kpi_principal: string | null
          last_sync: string | null
          linha_planilha: number | null
          marco_atual: string | null
          modelo_de_receita: string | null
          negocio: string | null
          objetivo_atual: string | null
          principal_gargalo: string | null
          problema_que_resolve: string | null
          proxima_entrega: string | null
          proximas_decisoes: string | null
          publico: string | null
          receita: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel_executivo: string | null
          riscos: string | null
          source_system: string | null
          sync_status: string | null
          updated_at: string | null
          visao: string | null
        }
        Insert: {
          ativo?: string | null
          atualizado_em?: string
          business_id: string
          caixa?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          definicao_de_saida_do_estagio?: string | null
          entity_id?: string | null
          estagio?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          kpi_principal?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          marco_atual?: string | null
          modelo_de_receita?: string | null
          negocio?: string | null
          objetivo_atual?: string | null
          principal_gargalo?: string | null
          problema_que_resolve?: string | null
          proxima_entrega?: string | null
          proximas_decisoes?: string | null
          publico?: string | null
          receita?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel_executivo?: string | null
          riscos?: string | null
          source_system?: string | null
          sync_status?: string | null
          updated_at?: string | null
          visao?: string | null
        }
        Update: {
          ativo?: string | null
          atualizado_em?: string
          business_id?: string
          caixa?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          definicao_de_saida_do_estagio?: string | null
          entity_id?: string | null
          estagio?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          kpi_principal?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          marco_atual?: string | null
          modelo_de_receita?: string | null
          negocio?: string | null
          objetivo_atual?: string | null
          principal_gargalo?: string | null
          problema_que_resolve?: string | null
          proxima_entrega?: string | null
          proximas_decisoes?: string | null
          publico?: string | null
          receita?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel_executivo?: string | null
          riscos?: string | null
          source_system?: string | null
          sync_status?: string | null
          updated_at?: string | null
          visao?: string | null
        }
        Relationships: []
      }
      processos: {
        Row: {
          area: string | null
          atualizado_em: string
          automation_id: string | null
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          entradas: string | null
          external_id: string | null
          external_updated_at: string | null
          ferramenta_automacao: string | null
          frequencia: string | null
          gargalo_observacoes: string | null
          gatilho: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          procedimento_passos: string | null
          process_id: string
          processo: string | null
          proxima_revisao: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          saidas_evidencia: string | null
          sla: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          ultima_revisao: string | null
          updated_at: string | null
          versao: string | null
        }
        Insert: {
          area?: string | null
          atualizado_em?: string
          automation_id?: string | null
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          entradas?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          ferramenta_automacao?: string | null
          frequencia?: string | null
          gargalo_observacoes?: string | null
          gatilho?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          procedimento_passos?: string | null
          process_id: string
          processo?: string | null
          proxima_revisao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          saidas_evidencia?: string | null
          sla?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          ultima_revisao?: string | null
          updated_at?: string | null
          versao?: string | null
        }
        Update: {
          area?: string | null
          atualizado_em?: string
          automation_id?: string | null
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          entradas?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          ferramenta_automacao?: string | null
          frequencia?: string | null
          gargalo_observacoes?: string | null
          gatilho?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          procedimento_passos?: string | null
          process_id?: string
          processo?: string | null
          proxima_revisao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          saidas_evidencia?: string | null
          sla?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          ultima_revisao?: string | null
          updated_at?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      produto: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          criterio_de_aceite: string | null
          data_alvo: string | null
          dependencias: string | null
          evidencia_teste: string | null
          external_id: string | null
          external_updated_at: string | null
          feedback_relacionado: string | null
          idempotency_key: string | null
          integration_id: string | null
          item: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          prioridade: string | null
          problema_hipotese: string | null
          product_item_id: string
          project_id: string | null
          related_object_id: string | null
          related_object_type: string | null
          release: string | null
          responsavel: string | null
          risco: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          criterio_de_aceite?: string | null
          data_alvo?: string | null
          dependencias?: string | null
          evidencia_teste?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          feedback_relacionado?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          item?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          prioridade?: string | null
          problema_hipotese?: string | null
          product_item_id: string
          project_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          release?: string | null
          responsavel?: string | null
          risco?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          criterio_de_aceite?: string | null
          data_alvo?: string | null
          dependencias?: string | null
          evidencia_teste?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          feedback_relacionado?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          item?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          prioridade?: string | null
          problema_hipotese?: string | null
          product_item_id?: string
          project_id?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          release?: string | null
          responsavel?: string | null
          risco?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projetos: {
        Row: {
          atualizado_em: string
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          criterio_de_conclusao: string | null
          dependencias: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          inicio: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          marco_atual: string | null
          objetivo: string | null
          observacoes: string | null
          prazo: string | null
          prioridade: string | null
          project_id: string
          projeto: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          risco_principal: string | null
          source_system: string | null
          sponsor: string | null
          status: string | null
          sync_status: string | null
          tipo: string | null
          ultima_atualizacao: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          criterio_de_conclusao?: string | null
          dependencias?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          marco_atual?: string | null
          objetivo?: string | null
          observacoes?: string | null
          prazo?: string | null
          prioridade?: string | null
          project_id: string
          projeto?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco_principal?: string | null
          source_system?: string | null
          sponsor?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          ultima_atualizacao?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          criterio_de_conclusao?: string | null
          dependencias?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          inicio?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          marco_atual?: string | null
          objetivo?: string | null
          observacoes?: string | null
          prazo?: string | null
          prioridade?: string | null
          project_id?: string
          projeto?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco_principal?: string | null
          source_system?: string | null
          sponsor?: string | null
          status?: string | null
          sync_status?: string | null
          tipo?: string | null
          ultima_atualizacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      protocolo_agentes: {
        Row: {
          aplicacao: string | null
          atualizado_em: string
          criado_em: string
          linha_planilha: number | null
          protocolo_id: string
          regra: string | null
          responsavel: string | null
          secao: string | null
          status: string | null
          ultima_atualizacao: string | null
          versao: string | null
        }
        Insert: {
          aplicacao?: string | null
          atualizado_em?: string
          criado_em?: string
          linha_planilha?: number | null
          protocolo_id: string
          regra?: string | null
          responsavel?: string | null
          secao?: string | null
          status?: string | null
          ultima_atualizacao?: string | null
          versao?: string | null
        }
        Update: {
          aplicacao?: string | null
          atualizado_em?: string
          criado_em?: string
          linha_planilha?: number | null
          protocolo_id?: string
          regra?: string | null
          responsavel?: string | null
          secao?: string | null
          status?: string | null
          ultima_atualizacao?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      recorrencias: {
        Row: {
          atualizado_em: string
          automation_id: string | null
          business_id: string | null
          catch_up_policy: string | null
          conferencia_integracao: string | null
          configuracao_da_regra: string | null
          conta_id: string | null
          contract_id: string | null
          created_at: string | null
          criado_em: string
          data_final: string | null
          data_inicial: string | null
          descricao: string | null
          equivalente_mensal_brl: string | null
          external_id: string | null
          external_updated_at: string | null
          frequencia: string | null
          gerar_automaticamente: string | null
          horario_confirmado: string | null
          idempotency_key: string | null
          integration_id: string | null
          intervalo: string | null
          last_sync: string | null
          linha_planilha: number | null
          moeda: string | null
          nome: string | null
          observacoes: string | null
          passos_desde_inicio: string | null
          plano_conta_id: string | null
          prazo_da_ocorrencia: string | null
          proxima_candidata: string | null
          proxima_ocorrencia: string | null
          recurrence_id: string
          regra_canonica: string | null
          regra_rrule: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          rule_version: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          target_sheet: string | null
          timezone: string | null
          tipo: string | null
          ultima_ocorrencia_materializada: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          automation_id?: string | null
          business_id?: string | null
          catch_up_policy?: string | null
          conferencia_integracao?: string | null
          configuracao_da_regra?: string | null
          conta_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          criado_em?: string
          data_final?: string | null
          data_inicial?: string | null
          descricao?: string | null
          equivalente_mensal_brl?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          frequencia?: string | null
          gerar_automaticamente?: string | null
          horario_confirmado?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          intervalo?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          nome?: string | null
          observacoes?: string | null
          passos_desde_inicio?: string | null
          plano_conta_id?: string | null
          prazo_da_ocorrencia?: string | null
          proxima_candidata?: string | null
          proxima_ocorrencia?: string | null
          recurrence_id: string
          regra_canonica?: string | null
          regra_rrule?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          rule_version?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          target_sheet?: string | null
          timezone?: string | null
          tipo?: string | null
          ultima_ocorrencia_materializada?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          automation_id?: string | null
          business_id?: string | null
          catch_up_policy?: string | null
          conferencia_integracao?: string | null
          configuracao_da_regra?: string | null
          conta_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          criado_em?: string
          data_final?: string | null
          data_inicial?: string | null
          descricao?: string | null
          equivalente_mensal_brl?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          frequencia?: string | null
          gerar_automaticamente?: string | null
          horario_confirmado?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          intervalo?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          moeda?: string | null
          nome?: string | null
          observacoes?: string | null
          passos_desde_inicio?: string | null
          plano_conta_id?: string | null
          prazo_da_ocorrencia?: string | null
          proxima_candidata?: string | null
          proxima_ocorrencia?: string | null
          recurrence_id?: string
          regra_canonica?: string | null
          regra_rrule?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          rule_version?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          target_sheet?: string | null
          timezone?: string | null
          tipo?: string | null
          ultima_ocorrencia_materializada?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      regras_formula: {
        Row: {
          coluna: string
          formula: string
          id: number
          tabela: string
        }
        Insert: {
          coluna: string
          formula: string
          id?: never
          tabela: string
        }
        Update: {
          coluna?: string
          formula?: string
          id?: never
          tabela?: string
        }
        Relationships: []
      }
      riscos: {
        Row: {
          atualizado_em: string
          business_id: string | null
          categoria: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          evidencia: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          impacto: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          observacoes: string | null
          plano_de_contingencia: string | null
          prazo_acao: string | null
          prevencao_mitigacao: string | null
          probabilidade: string | null
          project_id: string | null
          proxima_revisao: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          risco: string | null
          risk_id: string
          score: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          ultima_revisao: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          business_id?: string | null
          categoria?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          evidencia?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          impacto?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          plano_de_contingencia?: string | null
          prazo_acao?: string | null
          prevencao_mitigacao?: string | null
          probabilidade?: string | null
          project_id?: string | null
          proxima_revisao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco?: string | null
          risk_id: string
          score?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          ultima_revisao?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          business_id?: string | null
          categoria?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          evidencia?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          impacto?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          plano_de_contingencia?: string | null
          prazo_acao?: string | null
          prevencao_mitigacao?: string | null
          probabilidade?: string | null
          project_id?: string | null
          proxima_revisao?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          risco?: string | null
          risk_id?: string
          score?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          ultima_revisao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sistema_vivo: {
        Row: {
          atualizado_em: string
          conceito: string | null
          criado_em: string
          linha_planilha: number | null
          observacoes: string | null
          registro_id: number
          regra_operacional: string | null
          responsavel: string | null
        }
        Insert: {
          atualizado_em?: string
          conceito?: string | null
          criado_em?: string
          linha_planilha?: number | null
          observacoes?: string | null
          registro_id?: never
          regra_operacional?: string | null
          responsavel?: string | null
        }
        Update: {
          atualizado_em?: string
          conceito?: string | null
          criado_em?: string
          linha_planilha?: number | null
          observacoes?: string | null
          registro_id?: never
          regra_operacional?: string | null
          responsavel?: string | null
        }
        Relationships: []
      }
      societario: {
        Row: {
          atualizado_em: string
          classe: string | null
          criado_em: string
          data: string | null
          direito_voto: string | null
          documento_id: string | null
          entity_id: string | null
          linha_planilha: number | null
          observacoes: string | null
          percentual: string | null
          quantidade_unidades: string | null
          stake_id: string
          status: string | null
          tipo_participacao: string | null
          titular: string | null
        }
        Insert: {
          atualizado_em?: string
          classe?: string | null
          criado_em?: string
          data?: string | null
          direito_voto?: string | null
          documento_id?: string | null
          entity_id?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          percentual?: string | null
          quantidade_unidades?: string | null
          stake_id: string
          status?: string | null
          tipo_participacao?: string | null
          titular?: string | null
        }
        Update: {
          atualizado_em?: string
          classe?: string | null
          criado_em?: string
          data?: string | null
          direito_voto?: string | null
          documento_id?: string | null
          entity_id?: string | null
          linha_planilha?: number | null
          observacoes?: string | null
          percentual?: string | null
          quantidade_unidades?: string | null
          stake_id?: string
          status?: string | null
          tipo_participacao?: string | null
          titular?: string | null
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          acao: string | null
          atualizado_em: string
          business_id: string | null
          conflict_resolution: string | null
          correlation_id: string | null
          criado_em: string
          data_hora: string | null
          dead_letter: string | null
          direcao: string | null
          duracao_ms: string | null
          erro_codigo: string | null
          erro_mensagem: string | null
          executor: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          linha_planilha: number | null
          local_updated_at: string | null
          max_attempts: string | null
          object_id: string | null
          object_type: string | null
          observacoes: string | null
          payload_hash: string | null
          replay_of_sync_log_id: string | null
          resultado: string | null
          retry_after: string | null
          source_system: string | null
          status: string | null
          sync_log_id: string
          tentativa: string | null
        }
        Insert: {
          acao?: string | null
          atualizado_em?: string
          business_id?: string | null
          conflict_resolution?: string | null
          correlation_id?: string | null
          criado_em?: string
          data_hora?: string | null
          dead_letter?: string | null
          direcao?: string | null
          duracao_ms?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          executor?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          linha_planilha?: number | null
          local_updated_at?: string | null
          max_attempts?: string | null
          object_id?: string | null
          object_type?: string | null
          observacoes?: string | null
          payload_hash?: string | null
          replay_of_sync_log_id?: string | null
          resultado?: string | null
          retry_after?: string | null
          source_system?: string | null
          status?: string | null
          sync_log_id: string
          tentativa?: string | null
        }
        Update: {
          acao?: string | null
          atualizado_em?: string
          business_id?: string | null
          conflict_resolution?: string | null
          correlation_id?: string | null
          criado_em?: string
          data_hora?: string | null
          dead_letter?: string | null
          direcao?: string | null
          duracao_ms?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          executor?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          linha_planilha?: number | null
          local_updated_at?: string | null
          max_attempts?: string | null
          object_id?: string | null
          object_type?: string | null
          observacoes?: string | null
          payload_hash?: string | null
          replay_of_sync_log_id?: string | null
          resultado?: string | null
          retry_after?: string | null
          source_system?: string | null
          status?: string | null
          sync_log_id?: string
          tentativa?: string | null
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          atualizado_em: string
          bloqueio: string | null
          business_id: string | null
          conferencia_integracao: string | null
          created_at: string | null
          criado_em: string
          definicao_de_pronto: string | null
          evidencia: string | null
          execution_id: string | null
          external_id: string | null
          external_updated_at: string | null
          idempotency_key: string | null
          integration_id: string | null
          last_sync: string | null
          linha_planilha: number | null
          occurrence_date: string | null
          prazo: string | null
          prioridade: string | null
          project_id: string | null
          recurrence_id: string | null
          related_object: string | null
          related_object_id: string | null
          related_object_type: string | null
          responsavel: string | null
          source_system: string | null
          status: string | null
          sync_status: string | null
          tarefa: string | null
          task_id: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_em?: string
          bloqueio?: string | null
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          definicao_de_pronto?: string | null
          evidencia?: string | null
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          occurrence_date?: string | null
          prazo?: string | null
          prioridade?: string | null
          project_id?: string | null
          recurrence_id?: string | null
          related_object?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tarefa?: string | null
          task_id: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_em?: string
          bloqueio?: string | null
          business_id?: string | null
          conferencia_integracao?: string | null
          created_at?: string | null
          criado_em?: string
          definicao_de_pronto?: string | null
          evidencia?: string | null
          execution_id?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          idempotency_key?: string | null
          integration_id?: string | null
          last_sync?: string | null
          linha_planilha?: number | null
          occurrence_date?: string | null
          prazo?: string | null
          prioridade?: string | null
          project_id?: string | null
          recurrence_id?: string | null
          related_object?: string | null
          related_object_id?: string | null
          related_object_type?: string | null
          responsavel?: string | null
          source_system?: string | null
          status?: string | null
          sync_status?: string | null
          tarefa?: string | null
          task_id?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
