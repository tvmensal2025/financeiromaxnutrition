import { buildProfileUpdate, updateProfile, getProfile, DEFAULT_PROFILES_12, setActiveGlobalProfile } from './call-engine.mjs';

export function createProfileStore(db) {
  const rows = new Map();
  let loading;
  const conflict = () => Object.assign(new Error('Este perfil mudou em outra sessão. Recarregue antes de salvar; seu texto foi preservado.'), { status: 409 });
  async function load() {
    if (!loading) loading = (async () => {
      const data = await db('/rest/v1/configuracao?or=(chave.like.CALL_PROFILE_*,chave.eq.CALL_ACTIVE_GLOBAL_PROFILE)&select=registro_id,chave,valor,row_version');
      for (const row of data || []) {
        rows.set(row.chave, row);
        if (row.chave.startsWith('CALL_PROFILE_')) {
          const p = JSON.parse(row.valor);
          if (!DEFAULT_PROFILES_12[p.profile_key]) throw new Error('Perfil persistido inválido');
          updateProfile(p.character_id, p.mode, { ...p, row_version: row.row_version }, p.updated_by);
        }
      }
      const active = rows.get('CALL_ACTIVE_GLOBAL_PROFILE')?.valor;
      if (active && DEFAULT_PROFILES_12[active]) {
        const p = DEFAULT_PROFILES_12[active];
        setActiveGlobalProfile(p.character_id, p.mode, 'Configuração salva');
      }
    })().catch(err => { loading = null; throw err; });
    await loading;
  }
  async function write(key, value, by, expected) {
    const existing = rows.get(key);
    if (expected !== undefined && Number(expected) !== (existing?.row_version || 0)) throw conflict();
    let row;
    try {
      if (existing) {
        row = await db('/rest/v1/rpc/helena_write_record', { method: 'POST', body: JSON.stringify({
          p_table: 'configuracao', p_id: String(existing.registro_id), p_expected_version: existing.row_version,
          p_changes: { valor: value, responsavel: by }
        }) });
      } else {
        throw new Error('Configuração de perfil não provisionada no servidor.');
      }
    } catch (err) {
      if (err.data?.code === '40001' || err.data?.code === '23505') { loading = null; throw conflict(); }
      throw err;
    }
    if (!row?.row_version) throw new Error('O servidor não confirmou a gravação do perfil.');
    rows.set(key, row);
    return row;
  }
  return {
    load,
    async save(character, mode, changes, by, reset = false) {
      await load();
      const key = `${character}_${mode}`;
      if (!DEFAULT_PROFILES_12[key]) throw new Error('Perfil inválido');
      const target = reset ? DEFAULT_PROFILES_12[key] : changes;
      const profile = buildProfileUpdate(character, mode, target, by);
      const row = await write(`CALL_PROFILE_${key.toUpperCase()}`, JSON.stringify(profile), by, changes.row_version);
      return updateProfile(character, mode, { ...profile, row_version: row.row_version }, by).profile;
    },
    async activate(character, mode, by) {
      await load();
      const key = `${character}_${mode}`;
      if (!DEFAULT_PROFILES_12[key]) throw new Error('Perfil inválido');
      await write('CALL_ACTIVE_GLOBAL_PROFILE', key, by);
      return setActiveGlobalProfile(character, mode, by);
    }
  };
}
