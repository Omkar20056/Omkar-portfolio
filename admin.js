(() => {
  const config = window.PORTFOLIO_SUPABASE_CONFIG || {};
  const setupWarning = document.getElementById('setup-warning');
  const loginPanel = document.getElementById('login-panel');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('login-form');
  const loginMessage = document.getElementById('login-message');
  const entryForm = document.getElementById('entry-form');
  const entryMessage = document.getElementById('entry-message');
  const fileInput = document.getElementById('item-file');
  const typeInput = document.getElementById('item-type');
  const currentFile = document.getElementById('current-file');
  const fileRequired = document.getElementById('file-required');
  const fileHelp = document.getElementById('file-help');
  const entriesList = document.getElementById('entries-list');
  let client = null;
  let currentUser = null;
  let editing = null;
  let entries = [];

  const message = (node, text, isError = false) => {
    node.textContent = text || '';
    node.classList.toggle('error', isError);
  };
  const safeUrl = value => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  };
  const safeFileName = name => name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-90) || 'upload';
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const setBusy = (button, busy, label) => {
    button.disabled = busy;
    button.textContent = busy ? 'Please wait…' : label;
  };

  function syncFileHelp() {
    const isCertificate = typeInput.value === 'certificate';
    fileInput.accept = isCertificate ? '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp' : '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
    fileRequired.textContent = isCertificate && !editing?.asset_path ? '*' : '(optional)';
    fileHelp.textContent = isCertificate
      ? 'Upload a certificate PDF or image. This file will be publicly viewable on your portfolio.'
      : 'Optional: upload a project screenshot (PNG, JPG or WEBP).';
  }

  function showDashboard(user) {
    currentUser = user;
    loginPanel.hidden = true;
    dashboard.hidden = false;
    document.getElementById('signed-in-as').textContent = 'Signed in as ' + user.email;
    loadEntries();
  }

  async function verifyOwner(user) {
    const { data, error } = await client.rpc('is_portfolio_admin');
    if (error || data !== true) {
      await client.auth.signOut();
      loginPanel.hidden = false;
      dashboard.hidden = true;
      message(loginMessage, 'This account is not authorized for this dashboard.', true);
      return false;
    }
    showDashboard(user);
    return true;
  }

  async function loadEntries() {
    entriesList.replaceChildren(node('p', 'empty-state', 'Loading your entries…'));
    const { data, error } = await client.from('portfolio_items')
      .select('*').order('created_at', { ascending: false });
    if (error) {
      entriesList.replaceChildren(node('p', 'empty-state', 'Could not load entries: ' + error.message));
      return;
    }
    entries = data || [];
    document.getElementById('entry-count').textContent = entries.length;
    document.getElementById('project-count').textContent = entries.filter(x => x.item_type === 'project').length;
    document.getElementById('certificate-count').textContent = entries.filter(x => x.item_type === 'certificate').length;
    document.getElementById('list-count').textContent = entries.length;
    entriesList.replaceChildren();
    if (!entries.length) {
      entriesList.append(node('p', 'empty-state', 'No uploads yet. Add your first project or certificate using the form.'));
      return;
    }
    entries.forEach(entry => {
      const row = node('article', 'entry-row');
      row.append(node('span', 'entry-type', entry.item_type === 'project' ? 'PROJECT' : 'CERTIFICATE'));
      row.append(node('h3', '', entry.title));
      row.append(node('p', '', entry.description || ''));
      const actions = node('div', 'entry-actions');
      const edit = node('button', '', 'Edit');
      edit.type = 'button';
      edit.addEventListener('click', () => populateForm(entry));
      const remove = node('button', 'delete-entry', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', () => deleteEntry(entry));
      actions.append(edit, remove);
      row.append(actions);
      entriesList.append(row);
    });
  }

  function populateForm(entry) {
    editing = entry;
    document.getElementById('entry-id').value = entry.id;
    typeInput.value = entry.item_type;
    typeInput.disabled = true;
    document.getElementById('item-title').value = entry.title || '';
    document.getElementById('item-description').value = entry.description || '';
    document.getElementById('item-organization').value = entry.organization || '';
    document.getElementById('item-date').value = entry.completion_date || '';
    document.getElementById('item-technologies').value = (entry.technologies || []).join(', ');
    document.getElementById('item-github').value = entry.github_url || '';
    document.getElementById('item-live').value = entry.live_url || '';
    document.getElementById('item-credential').value = entry.credential_url || '';
    fileInput.value = '';
    currentFile.hidden = !entry.asset_url;
    currentFile.textContent = entry.asset_url ? 'Current file is attached. Choose another file only if you want to replace it.' : '';
    document.getElementById('form-heading').textContent = 'Edit portfolio entry';
    document.getElementById('save-entry').textContent = 'Save changes ↗';
    document.getElementById('cancel-edit').hidden = false;
    syncFileHelp();
    document.getElementById('entry-form').scrollIntoView({behavior:'smooth', block:'start'});
  }

  function resetForm() {
    entryForm.reset();
    document.getElementById('entry-id').value = '';
    editing = null;
    typeInput.disabled = false;
    currentFile.hidden = true;
    currentFile.textContent = '';
    document.getElementById('form-heading').textContent = 'Add to portfolio';
    document.getElementById('save-entry').textContent = 'Publish to portfolio ↗';
    document.getElementById('cancel-edit').hidden = true;
    syncFileHelp();
  }

  async function uploadAsset(file, type) {
    const allowed = type === 'certificate'
      ? ['application/pdf','image/png','image/jpeg','image/webp']
      : ['image/png','image/jpeg','image/webp'];
    if (!allowed.includes(file.type)) throw new Error(type === 'certificate' ? 'Choose a PDF, PNG, JPG or WEBP certificate.' : 'Project screenshots must be PNG, JPG or WEBP images.');
    if (file.size > 20 * 1024 * 1024) throw new Error('File is larger than 20 MB. Please choose a smaller file.');
    const path = currentUser.id + '/' + type + '/' + crypto.randomUUID() + '-' + safeFileName(file.name);
    const { error } = await client.storage.from('portfolio-assets').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (error) throw error;
    const { data } = client.storage.from('portfolio-assets').getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function saveEntry(event) {
    event.preventDefault();
    const button = document.getElementById('save-entry');
    const originalLabel = editing ? 'Save changes ↗' : 'Publish to portfolio ↗';
    setBusy(button, true, originalLabel);
    message(entryMessage, 'Saving your entry…');
    let newlyUploadedPath = null;
    try {
      const type = typeInput.value;
      const file = fileInput.files[0];
      if (type === 'certificate' && !file && !editing?.asset_path) throw new Error('Please upload the certificate file.');
      const github = document.getElementById('item-github').value.trim();
      const live = document.getElementById('item-live').value.trim();
      const credential = document.getElementById('item-credential').value.trim();
      if (github && !safeUrl(github)) throw new Error('Enter a valid http(s) GitHub URL.');
      if (live && !safeUrl(live)) throw new Error('Enter a valid http(s) live demo URL.');
      if (credential && !safeUrl(credential)) throw new Error('Enter a valid http(s) verification URL.');

      let asset = { path: editing?.asset_path || null, url: editing?.asset_url || null };
      if (file) {
        asset = await uploadAsset(file, type);
        newlyUploadedPath = asset.path;
      }
      const technologies = document.getElementById('item-technologies').value
        .split(',').map(x => x.trim()).filter(Boolean).slice(0,20);
      const record = {
        owner_id: currentUser.id,
        item_type: type,
        title: document.getElementById('item-title').value.trim(),
        description: document.getElementById('item-description').value.trim(),
        organization: document.getElementById('item-organization').value.trim() || null,
        completion_date: document.getElementById('item-date').value || null,
        technologies,
        github_url: safeUrl(github),
        live_url: safeUrl(live),
        credential_url: safeUrl(credential),
        asset_url: asset.url,
        asset_path: asset.path,
        status: 'published'
      };
      if (editing) {
        const previousAssetPath = editing.asset_path;
        const { error } = await client.from('portfolio_items').update(record).eq('id', editing.id);
        if (error) throw error;
        if (file && previousAssetPath) {
          await client.storage.from('portfolio-assets').remove([previousAssetPath]);
        }
      } else {
        const { error } = await client.from('portfolio_items').insert(record);
        if (error) throw error;
      }
      newlyUploadedPath = null;
      message(entryMessage, 'Published successfully! Your portfolio will show the new entry when refreshed.');
      resetForm();
      await loadEntries();
    } catch (error) {
      if (newlyUploadedPath) {
        await client.storage.from('portfolio-assets').remove([newlyUploadedPath]);
      }
      message(entryMessage, error.message || 'Something went wrong while saving.', true);
    } finally {
      setBusy(button, false, document.getElementById('entry-id').value ? 'Save changes ↗' : 'Publish to portfolio ↗');
    }
  }

  async function deleteEntry(entry) {
    if (!window.confirm('Delete "' + entry.title + '" from your portfolio? This cannot be undone.')) return;
    try {
      const { error } = await client.from('portfolio_items').delete().eq('id', entry.id);
      if (error) throw error;
      if (entry.asset_path) {
        await client.storage.from('portfolio-assets').remove([entry.asset_path]);
      }
      if (editing?.id === entry.id) resetForm();
      message(entryMessage, 'Entry deleted from your portfolio.');
      await loadEntries();
    } catch (error) {
      message(entryMessage, 'Could not delete entry: ' + error.message, true);
    }
  }

  if (!config.url || !config.anonKey || !window.supabase) {
    setupWarning.hidden = false;
    loginPanel.hidden = true;
    return;
  }

  client = window.supabase.createClient(config.url, config.anonKey);
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    setBusy(button, true, 'Sign in securely ↗');
    message(loginMessage, 'Checking your access…');
    const { data, error } = await client.auth.signInWithPassword({
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    });
    setBusy(button, false, 'Sign in securely ↗');
    if (error) return message(loginMessage, error.message, true);
    await verifyOwner(data.user);
  });

  document.getElementById('sign-out').addEventListener('click', async () => {
    await client.auth.signOut();
    currentUser = null;
    dashboard.hidden = true;
    loginPanel.hidden = false;
    message(loginMessage, 'You have signed out.');
  });
  entryForm.addEventListener('submit', saveEntry);
  typeInput.addEventListener('change', syncFileHelp);
  document.getElementById('cancel-edit').addEventListener('click', resetForm);
  syncFileHelp();

  client.auth.getSession().then(async ({data}) => {
    if (data.session?.user) await verifyOwner(data.session.user);
  });
  client.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      dashboard.hidden = true;
      loginPanel.hidden = false;
      currentUser = null;
    }
  });
})();
