const menu=document.getElementById('menu'),nav=document.getElementById('nav');
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu')});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation menu')}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation menu');menu.focus()}});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
const progress=document.getElementById('progress');window.addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=(max?scrollY/max*100:0)+'%'},{passive:true});


// Dynamic portfolio entries uploaded through the private Omkar Control Center.
// Existing hand-written cards above remain untouched; published entries are appended.
(async function loadDynamicPortfolioEntries(){
  const config = window.PORTFOLIO_SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.anonKey);
  const projectHost = document.getElementById('dynamic-projects');
  const certificateHost = document.getElementById('dynamic-certificates');
  if (!projectHost || !certificateHost) return;

  const safeExternalUrl = value => {
    if (!value) return '';
    try {
      const parsed = new URL(value);
      return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) { return ''; }
  };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const link = (label, url) => {
    const href = safeExternalUrl(url);
    if (!href) return null;
    const a = make('a', 'link', label + ' ↗');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  };

  try {
    const { data, error } = await client
      .from('portfolio_items')
      .select('id,item_type,title,description,organization,completion_date,technologies,github_url,live_url,credential_url,asset_url')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (error) throw error;

    (data || []).forEach(item => {
      const card = make('article', 'skill reveal dynamic-card');
      card.append(make('div', 'symbol', item.item_type === 'project' ? '✦' : '✓'));
      card.append(make('p', 'eyebrow', item.item_type === 'project' ? 'ADDED PROJECT' : 'ADDED CERTIFICATE'));
      card.append(make('h3', '', item.title || 'Untitled'));
      if (item.organization) card.append(make('p', 'sub dynamic-meta', item.organization));
      if (item.completion_date) {
        const date = new Date(item.completion_date + 'T00:00:00');
        if (!Number.isNaN(date.getTime())) card.append(make('p', 'sub dynamic-meta', date.toLocaleDateString(undefined, {day:'numeric', month:'long', year:'numeric'})));
      }
      if (item.description) card.append(make('p', 'sub', item.description));

      if (item.item_type === 'project') {
        if (Array.isArray(item.technologies) && item.technologies.length) {
          const tags = make('div', 'tags');
          item.technologies.forEach(tag => tags.append(make('span', '', tag)));
          card.append(tags);
        }
        const actions = make('div', 'project-links');
        const source = link('View source code', item.github_url);
        const demo = link('Live demo', item.live_url);
        const asset = link('Project image', item.asset_url);
        [source, demo, asset].forEach(a => { if (a) actions.append(a); });
        if (actions.childElementCount) card.append(actions);
        projectHost.append(card);
      } else {
        const certificateUrl = safeExternalUrl(item.asset_url) || safeExternalUrl(item.credential_url);
        const certificateLink = link('View certificate', certificateUrl);
        if (certificateLink) card.append(certificateLink);
        const verifyLink = link('Verify credential', item.credential_url);
        if (verifyLink && item.asset_url) card.append(verifyLink);
        certificateHost.append(card);
      }
      observer.observe(card);
    });
  } catch (error) {
    console.error('Could not load additional portfolio entries:', error.message);
  }
})();
