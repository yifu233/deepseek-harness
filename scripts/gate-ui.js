(() => {
  'use strict';

  // Boot ordering: the host shell must not start until the visitor is known,
  // so index.html withholds the shell's module script behind
  // __DSH_BOOT_SHELL__ and this gate calls it exactly once. Until then this
  // overlay owns the viewport.
  const intl = location.hostname.endsWith('.edgeone.dev');
  const L = intl ? 'en' : 'zh';

  const copy = {
    zh: {
      loading: '正在检查登录状态…',
      setupEyebrow: '首次设置',
      setupTitle: '设置管理员账号',
      setupIntro: '这个部署还没有管理员。现在设置的人将成为管理员。',
      setupWarn: '部署完成后请立刻设置。谁先设置，谁就是管理员。',
      loginEyebrow: '登录',
      loginTitle: 'DeepSeek Harness',
      loginIntro: '这里不开放自助注册。没有账号请联系管理员为你创建。',
      username: '用户名',
      password: '密码',
      confirm: '确认密码',
      usernameHint: '3–32 位，字母、数字、下划线、点或连字符',
      passwordHint: '至少 8 位，不能是常见弱密码',
      createAdmin: '成为管理员',
      signIn: '登录',
      working: '处理中…',
      credit: 'made by yifu233',
      panelTitle: '账号',
      close: '关闭',
      role: '角色',
      admin: '管理员',
      user: '用户',
      disabled: '已停用',
      usage: 'Token 用量',
      unlimited: '无限制',
      myKey: '我的 API Key',
      keySet: '已设置私人 Key，留空保存则不改动',
      keyNone: '当前使用公共 Key',
      keyLabel: 'API Key',
      baseUrlLabel: 'Base URL（可选）',
      save: '保存',
      clear: '清除',
      keyCaution: 'Key 存在服务器上，管理员在技术上可以读取。这不是端到端加密。',
      logout: '退出登录',
      users: '用户管理',
      createUser: '新建用户',
      quota: '配额',
      quotaBlank: '留空为无限制',
      create: '创建',
      colUser: '用户',
      colRole: '角色',
      colUsage: '用量 / 配额',
      colActions: '操作',
      edit: '管理',
      saveQuota: '保存配额',
      disable: '停用',
      enable: '启用',
      resetPw: '重置密码',
      newPassword: '新密码',
      del: '删除',
      confirmDelete: '确定删除用户 %s？其工作区记录和用量将一并清除。',
      defaults: '新用户默认配额',
      saved: '已保存',
      noUsers: '还没有其他用户',
      errNetwork: '网络异常，请重试。',
      errMismatch: '两次输入的密码不一致。',
      'err.already-claimed': '管理员已被设置，请改用登录。',
      'err.invalid-username': '用户名格式不符合要求。',
      'err.weak-password': '密码太弱，请至少 8 位且避免常见密码。',
      'err.invalid-credentials': '用户名或密码不正确。',
      'err.disabled': '该账号已被停用，请联系管理员。',
      'err.duplicate': '该用户名已存在。',
      'err.forbidden': '需要管理员权限。',
      'err.cannot-delete-self': '不能删除自己。',
      'err.not-found': '用户不存在。',
      'err.server-misconfigured': '服务端未配置 JWT_SECRET，请在环境变量中设置后重新部署。',
      'err.storage-unavailable': '存储不可用，请检查 Blob 是否已开通。'
    },
    en: {
      loading: 'Checking your session…',
      setupEyebrow: 'First run',
      setupTitle: 'Create the administrator',
      setupIntro: 'This deployment has no administrator yet. Whoever sets one now becomes the administrator.',
      setupWarn: 'Do this immediately after deploying. The first person to set it becomes the administrator.',
      loginEyebrow: 'Sign in',
      loginTitle: 'DeepSeek Harness',
      loginIntro: 'There is no self-registration. Ask the administrator to create an account for you.',
      username: 'Username',
      password: 'Password',
      confirm: 'Confirm password',
      usernameHint: '3–32 characters: letters, digits, underscore, dot or hyphen',
      passwordHint: 'At least 8 characters, and not a common password',
      createAdmin: 'Become administrator',
      signIn: 'Sign in',
      working: 'Working…',
      credit: 'made by yifu233',
      panelTitle: 'Account',
      close: 'Close',
      role: 'Role',
      admin: 'Administrator',
      user: 'User',
      disabled: 'Disabled',
      usage: 'Token usage',
      unlimited: 'Unlimited',
      myKey: 'My API key',
      keySet: 'A private key is set. Save with the field empty to leave it unchanged.',
      keyNone: 'Currently using the shared key',
      keyLabel: 'API key',
      baseUrlLabel: 'Base URL (optional)',
      save: 'Save',
      clear: 'Clear',
      keyCaution: 'Keys are stored server-side and the administrator can technically read them. This is not end-to-end encrypted.',
      logout: 'Log out',
      users: 'Users',
      createUser: 'Create user',
      quota: 'Quota',
      quotaBlank: 'Leave blank for unlimited',
      create: 'Create',
      colUser: 'User',
      colRole: 'Role',
      colUsage: 'Used / quota',
      colActions: 'Actions',
      edit: 'Manage',
      saveQuota: 'Save quota',
      disable: 'Disable',
      enable: 'Enable',
      resetPw: 'Reset password',
      newPassword: 'New password',
      del: 'Delete',
      confirmDelete: 'Delete user %s? Their usage records will be removed too.',
      defaults: 'Default quota for new users',
      saved: 'Saved',
      noUsers: 'No other users yet',
      errNetwork: 'Network problem. Please try again.',
      errMismatch: 'The two passwords do not match.',
      'err.already-claimed': 'An administrator already exists. Sign in instead.',
      'err.invalid-username': 'That username format is not allowed.',
      'err.weak-password': 'Password too weak: at least 8 characters and not a common one.',
      'err.invalid-credentials': 'Wrong username or password.',
      'err.disabled': 'This account is disabled. Contact the administrator.',
      'err.duplicate': 'That username already exists.',
      'err.forbidden': 'Administrator access required.',
      'err.cannot-delete-self': 'You cannot delete yourself.',
      'err.not-found': 'No such user.',
      'err.server-misconfigured': 'JWT_SECRET is not configured on the server. Set it and redeploy.',
      'err.storage-unavailable': 'Storage unavailable. Check that Blob is enabled.'
    }
  };

  const t = (key) => copy[L][key] || key;
  const errText = (code) => t('err.' + code) || t('errNetwork');

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    // Always textContent, never innerHTML: some of these strings are usernames
    // and server messages.
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  async function api(path, options) {
    const init = Object.assign({ credentials: 'same-origin', headers: {} }, options || {});
    if (init.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(init.body);
      init.method = init.method || 'POST';
    }
    let response;
    try {
      response = await fetch(path, init);
    } catch (_) {
      return { ok: false, error: 'network', status: 0 };
    }
    let data = {};
    try {
      data = await response.json();
    } catch (_) { /* empty or non-JSON body */ }
    if (!response.ok) {
      return { ok: false, error: data.error || 'network', status: response.status, data: data };
    }
    return { ok: true, data: data, status: response.status };
  }

  const fmt = (value) => Number(value || 0).toLocaleString(L === 'zh' ? 'zh-CN' : 'en-US');

  // ---------------------------------------------------------------- overlay

  let overlay = null;
  let released = false;
  let booted = false;

  function releaseTo(conversationId) {
    if (released) return;
    released = true;
    window.__DSH_SET_CONVERSATION_ID__(conversationId);
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    document.removeEventListener('keydown', trapTab, true);
    if (!booted) {
      booted = true;
      window.__DSH_BOOT_SHELL__();
    }
  }

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('input,button,a[href],select,textarea,[tabindex]:not([tabindex="-1"])'),
      (node) => !node.disabled && node.offsetParent !== null
    );
  }

  // While the overlay is up nothing behind it may receive focus, otherwise Tab
  // walks into the shell that has not booted yet.
  function trapTab(event) {
    if (!overlay || event.key !== 'Tab') return;
    const items = focusables(overlay);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = el('div', 'dsh-gate-overlay');
    overlay.id = 'dsh-gate-overlay';
    document.body.appendChild(overlay);
    document.addEventListener('keydown', trapTab, true);
    return overlay;
  }

  function renderLoading() {
    const host = ensureOverlay();
    host.textContent = '';
    const box = el('div', 'dsh-gate-loading');
    box.appendChild(el('span', 'dsh-gate-spinner'));
    box.appendChild(el('span', null, t('loading')));
    host.appendChild(box);
  }

  function field(labelText, hintText, attrs) {
    const wrap = el('div', 'dsh-gate-field');
    const input = el('input', 'dsh-gate-input');
    input.id = 'dsh-gate-f-' + Math.random().toString(36).slice(2, 9);
    Object.keys(attrs).forEach((key) => { input.setAttribute(key, attrs[key]); });
    const label = el('label', 'dsh-gate-label', labelText);
    label.setAttribute('for', input.id);
    wrap.appendChild(label);
    wrap.appendChild(input);
    if (hintText) wrap.appendChild(el('div', 'dsh-gate-hint', hintText));
    return { wrap: wrap, input: input };
  }

  function renderCard(mode) {
    const setup = mode === 'setup';
    const host = ensureOverlay();
    host.textContent = '';

    const card = el('div', 'dsh-gate-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const mark = el('div', 'dsh-gate-mark');
    mark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 4v5c0 4.4-2.9 8.2-7 9-4.1-.8-7-4.6-7-9V7z"/><path d="M9 12l2 2 4-4"/></svg>';
    card.appendChild(mark);

    card.appendChild(el('div', 'dsh-gate-eyebrow', setup ? t('setupEyebrow') : t('loginEyebrow')));
    const title = el('h1', 'dsh-gate-title', setup ? t('setupTitle') : t('loginTitle'));
    title.id = 'dsh-gate-title';
    card.setAttribute('aria-labelledby', title.id);
    card.appendChild(title);
    card.appendChild(el('p', 'dsh-gate-intro', setup ? t('setupIntro') : t('loginIntro')));
    if (setup) card.appendChild(el('div', 'dsh-gate-warn', t('setupWarn')));

    const form = el('form', 'dsh-gate-form');
    form.noValidate = true;
    const user = field(t('username'), setup ? t('usernameHint') : null, {
      type: 'text', name: 'username', autocomplete: 'username', required: 'required', spellcheck: 'false'
    });
    const pass = field(t('password'), setup ? t('passwordHint') : null, {
      type: 'password', name: 'password',
      autocomplete: setup ? 'new-password' : 'current-password', required: 'required'
    });
    form.appendChild(user.wrap);
    form.appendChild(pass.wrap);
    let confirmField = null;
    if (setup) {
      confirmField = field(t('confirm'), null, {
        type: 'password', name: 'confirm', autocomplete: 'new-password', required: 'required'
      });
      form.appendChild(confirmField.wrap);
    }

    const alert = el('div', 'dsh-gate-alert');
    alert.setAttribute('role', 'alert');
    alert.hidden = true;
    form.appendChild(alert);

    const submit = el('button', 'dsh-gate-btn dsh-gate-btn-primary dsh-gate-btn-block',
      setup ? t('createAdmin') : t('signIn'));
    submit.type = 'submit';
    form.appendChild(submit);

    const fail = (message) => {
      alert.textContent = message;
      alert.hidden = false;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      alert.hidden = true;
      if (setup && confirmField && pass.input.value !== confirmField.input.value) {
        fail(t('errMismatch'));
        confirmField.input.focus();
        return;
      }
      submit.disabled = true;
      submit.textContent = t('working');
      const result = await api(setup ? '/auth/claim' : '/auth/login', {
        body: { username: user.input.value.trim(), password: pass.input.value }
      });
      if (result.ok && result.data && result.data.conversationId) {
        releaseTo(result.data.conversationId);
        return;
      }
      submit.disabled = false;
      submit.textContent = setup ? t('createAdmin') : t('signIn');
      fail(result.error === 'network' ? t('errNetwork') : errText(result.error));
      if (result.error === 'already-claimed') start();
    });

    card.appendChild(form);
    const footer = el('div', 'dsh-gate-footer');
    footer.appendChild(el('span', 'dsh-gate-credit', t('credit')));
    card.appendChild(footer);
    host.appendChild(card);
    user.input.focus();
  }

  // ------------------------------------------------------------------ panel

  let me = null;
  let launcher = null;
  let panel = null;

  function section(titleText) {
    const node = el('section', 'dsh-gate-section');
    if (titleText) node.appendChild(el('h3', 'dsh-gate-section-title', titleText));
    return node;
  }

  function meter(used, quota) {
    const wrap = el('div', 'dsh-gate-usage');
    const row = el('div', null);
    row.appendChild(el('span', null, t('usage')));
    row.appendChild(el('span', 'dsh-gate-usage-value',
      fmt(used) + ' / ' + (quota === null || quota === undefined ? t('unlimited') : fmt(quota))));
    wrap.appendChild(row);
    if (quota !== null && quota !== undefined && quota > 0) {
      const bar = el('div', 'dsh-gate-meter');
      const fill = el('div', 'dsh-gate-meter-fill');
      const pct = Math.min(100, Math.round((used / quota) * 100));
      fill.style.width = pct + '%';
      fill.setAttribute('data-level', pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');
      bar.appendChild(fill);
      wrap.appendChild(bar);
    }
    return wrap;
  }

  function buildAccountSection() {
    const node = section(null);
    const identity = el('div', 'dsh-gate-identity');
    identity.appendChild(el('span', 'dsh-gate-identity-name', me.username));
    const tag = el('span', 'dsh-gate-tag' + (me.role === 'admin' ? ' dsh-gate-tag-admin' : ''),
      me.role === 'admin' ? t('admin') : t('user'));
    identity.appendChild(tag);
    node.appendChild(identity);
    node.appendChild(meter(me.usedTokens, me.quotaTokens));
    return node;
  }

  function buildKeySection() {
    const node = section(t('myKey'));
    node.appendChild(el('p', 'dsh-gate-section-note', me.hasPrivateKey ? t('keySet') : t('keyNone')));

    const key = field(t('keyLabel'), null, { type: 'password', autocomplete: 'off', placeholder: 'sk-…' });
    const base = field(t('baseUrlLabel'), null, {
      type: 'url', autocomplete: 'off', placeholder: 'https://api.example.com/v1'
    });
    if (me.privateBaseUrl) base.input.value = me.privateBaseUrl;
    node.appendChild(key.wrap);
    node.appendChild(base.wrap);
    node.appendChild(el('p', 'dsh-gate-caution', t('keyCaution')));

    const status = el('div', 'dsh-gate-status');
    status.setAttribute('role', 'alert');
    status.hidden = true;
    node.appendChild(status);

    const actions = el('div', 'dsh-gate-actions');
    const save = el('button', 'dsh-gate-btn dsh-gate-btn-primary', t('save'));
    save.type = 'button';
    const clear = el('button', 'dsh-gate-btn dsh-gate-btn-quiet', t('clear'));
    clear.type = 'button';
    actions.appendChild(save);
    actions.appendChild(clear);
    node.appendChild(actions);

    const send = async (apiKey, baseUrl, button) => {
      status.hidden = true;
      button.disabled = true;
      const label = button.textContent;
      button.textContent = t('working');
      const result = await api('/account/apikey', { body: { apiKey: apiKey, baseUrl: baseUrl } });
      button.disabled = false;
      button.textContent = label;
      status.textContent = result.ok ? t('saved') : errText(result.error);
      status.hidden = false;
      if (result.ok) await refresh();
    };

    save.addEventListener('click', () => {
      const value = key.input.value.trim();
      if (value.length === 0 && !me.hasPrivateKey) {
        status.textContent = errText('invalid-credentials');
        status.hidden = false;
        return;
      }
      send(value.length === 0 ? undefined : value, base.input.value.trim() || null, save);
    });
    clear.addEventListener('click', () => {
      key.input.value = '';
      send(null, null, clear);
    });
    return node;
  }

  function quotaCell(user) {
    const input = el('input', 'dsh-gate-quota-input');
    input.type = 'number';
    input.min = '0';
    input.step = '1000';
    input.setAttribute('aria-label', t('quota') + ' — ' + user.username);
    input.placeholder = t('unlimited');
    if (user.quotaTokens !== null && user.quotaTokens !== undefined) input.value = String(user.quotaTokens);
    return input;
  }

  function buildAdminSection() {
    const node = section(t('users'));
    const status = el('div', 'dsh-gate-status');
    status.setAttribute('role', 'alert');
    status.hidden = true;

    const report = (message) => {
      status.textContent = message;
      status.hidden = false;
    };

    const wrap = el('div', 'dsh-gate-tablewrap');
    const table = el('table', 'dsh-gate-table');
    const head = el('thead');
    const headRow = el('tr');
    [t('colUser'), t('colRole'), t('colUsage'), t('colActions')].forEach((label) => {
      const th = el('th', null, label);
      th.scope = 'col';
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = el('tbody');
    table.appendChild(body);
    wrap.appendChild(table);
    node.appendChild(wrap);
    node.appendChild(status);

    const act = async (path, payload, done) => {
      status.hidden = true;
      const result = await api(path, { body: payload });
      if (!result.ok) {
        report(errText(result.error));
        return false;
      }
      if (done) done();
      return true;
    };

    const paint = (users) => {
      body.textContent = '';
      if (users.length === 0) {
        const row = el('tr');
        const cell = el('td', 'dsh-gate-empty', t('noUsers'));
        cell.colSpan = 4;
        row.appendChild(cell);
        body.appendChild(row);
        return;
      }
      users.forEach((user) => {
        const row = el('tr');
        const name = el('td', 'dsh-gate-cell-name');
        name.appendChild(el('span', null, user.username));
        if (user.disabled) name.appendChild(el('span', 'dsh-gate-tag dsh-gate-tag-off', t('disabled')));
        row.appendChild(name);
        row.appendChild(el('td', null, user.role === 'admin' ? t('admin') : t('user')));
        row.appendChild(el('td', 'dsh-gate-num',
          fmt(user.usedTokens) + ' / ' +
          (user.quotaTokens === null || user.quotaTokens === undefined ? t('unlimited') : fmt(user.quotaTokens))));

        const actions = el('td', 'dsh-gate-cell-actions');
        const toggle = el('button', 'dsh-gate-btn dsh-gate-btn-tiny dsh-gate-btn-quiet', t('edit'));
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        actions.appendChild(toggle);
        row.appendChild(actions);
        body.appendChild(row);

        const detail = el('tr', 'dsh-gate-detail');
        detail.hidden = true;
        const detailCell = el('td');
        detailCell.colSpan = 4;
        const inner = el('div', 'dsh-gate-detail-inner');

        const quota = quotaCell(user);
        const saveQuota = el('button', 'dsh-gate-btn dsh-gate-btn-tiny dsh-gate-btn-primary', t('saveQuota'));
        saveQuota.type = 'button';
        saveQuota.addEventListener('click', async () => {
          const raw = quota.value.trim();
          const value = raw.length === 0 ? null : Number(raw);
          if (value !== null && (!Number.isSafeInteger(value) || value < 0)) return report(errText('invalid-username'));
          await act('/admin/users/update', { id: user.id, quotaTokens: value }, refreshAdmin);
        });

        const ban = el('button', 'dsh-gate-btn dsh-gate-btn-tiny dsh-gate-btn-quiet',
          user.disabled ? t('enable') : t('disable'));
        ban.type = 'button';
        ban.addEventListener('click', async () => {
          await act('/admin/users/update', { id: user.id, disabled: !user.disabled }, refreshAdmin);
        });

        const pw = el('input', 'dsh-gate-input');
        pw.type = 'password';
        pw.autocomplete = 'new-password';
        pw.placeholder = t('newPassword');
        pw.setAttribute('aria-label', t('newPassword') + ' — ' + user.username);
        const resetPw = el('button', 'dsh-gate-btn dsh-gate-btn-tiny dsh-gate-btn-quiet', t('resetPw'));
        resetPw.type = 'button';
        resetPw.addEventListener('click', async () => {
          if (pw.value.length === 0) return;
          const done = await act('/admin/users/update', { id: user.id, password: pw.value });
          if (done) {
            pw.value = '';
            report(t('saved'));
          }
        });

        const remove = el('button', 'dsh-gate-btn dsh-gate-btn-tiny dsh-gate-btn-danger', t('del'));
        remove.type = 'button';
        remove.addEventListener('click', async () => {
          if (!window.confirm(t('confirmDelete').replace('%s', user.username))) return;
          await act('/admin/users/delete', { id: user.id }, refreshAdmin);
        });

        inner.appendChild(el('span', 'dsh-gate-detail-text', t('quota')));
        inner.appendChild(quota);
        inner.appendChild(saveQuota);
        inner.appendChild(ban);
        inner.appendChild(pw);
        inner.appendChild(resetPw);
        inner.appendChild(remove);
        detailCell.appendChild(inner);
        detail.appendChild(detailCell);
        body.appendChild(detail);

        toggle.addEventListener('click', () => {
          const open = detail.hidden;
          detail.hidden = !open;
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      });
    };

    // Create user
    const create = el('form', 'dsh-gate-row');
    const newUser = field(t('username'), null, { type: 'text', autocomplete: 'off', required: 'required' });
    const newPass = field(t('password'), null, { type: 'password', autocomplete: 'new-password', required: 'required' });
    const newQuota = field(t('quota'), t('quotaBlank'), { type: 'number', min: '0', step: '1000' });
    const createBtn = el('button', 'dsh-gate-btn dsh-gate-btn-primary', t('create'));
    createBtn.type = 'submit';
    create.appendChild(newUser.wrap);
    create.appendChild(newPass.wrap);
    create.appendChild(newQuota.wrap);
    create.appendChild(createBtn);
    create.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = newQuota.input.value.trim();
      const ok = await act('/admin/users', {
        username: newUser.input.value.trim(),
        password: newPass.input.value,
        quotaTokens: raw.length === 0 ? null : Number(raw)
      }, refreshAdmin);
      if (ok) {
        newUser.input.value = '';
        newPass.input.value = '';
        newQuota.input.value = '';
        report(t('saved'));
      }
    });
    node.appendChild(el('h3', 'dsh-gate-section-title', t('createUser')));
    node.appendChild(create);

    // Default quota
    const defaults = el('form', 'dsh-gate-row');
    const defaultQuota = field(t('defaults'), t('quotaBlank'), { type: 'number', min: '0', step: '1000' });
    const saveDefaults = el('button', 'dsh-gate-btn dsh-gate-btn-quiet', t('save'));
    saveDefaults.type = 'submit';
    defaults.appendChild(defaultQuota.wrap);
    defaults.appendChild(saveDefaults);
    defaults.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = defaultQuota.input.value.trim();
      const ok = await act('/admin/settings', { defaultQuotaTokens: raw.length === 0 ? null : Number(raw) });
      if (ok) report(t('saved'));
    });
    node.appendChild(defaults);

    async function refreshAdmin() {
      const [users, settings] = await Promise.all([api('/admin/users'), api('/admin/settings')]);
      if (users.ok && users.data && Array.isArray(users.data.users)) paint(users.data.users);
      else report(errText(users.error));
      if (settings.ok && settings.data) {
        const value = settings.data.defaultQuotaTokens;
        defaultQuota.input.value = value === null || value === undefined ? '' : String(value);
      }
    }

    refreshAdmin();
    return node;
  }

  function buildPanel() {
    panel = el('div', 'dsh-gate-panel');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');

    const head = el('div', 'dsh-gate-panel-head');
    const title = el('h2', 'dsh-gate-panel-title', t('panelTitle'));
    title.id = 'dsh-gate-panel-title';
    panel.setAttribute('aria-labelledby', title.id);
    const close = el('button', 'dsh-gate-close');
    close.type = 'button';
    close.setAttribute('aria-label', t('close'));
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', closePanel);
    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    const body = el('div', 'dsh-gate-panel-body');
    body.appendChild(buildAccountSection());
    body.appendChild(buildKeySection());
    if (me.role === 'admin') body.appendChild(buildAdminSection());

    const out = section(null);
    const logout = el('button', 'dsh-gate-btn dsh-gate-btn-quiet dsh-gate-btn-block', t('logout'));
    logout.type = 'button';
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      await api('/auth/logout', { method: 'POST', body: {} });
      location.reload();
    });
    out.appendChild(logout);
    body.appendChild(out);

    panel.appendChild(body);
    document.body.appendChild(panel);
  }

  function openPanel() {
    if (panel) panel.remove();
    buildPanel();
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    const items = focusables(panel);
    if (items.length > 0) items[0].focus();
    document.addEventListener('keydown', panelEscape, true);
  }

  function closePanel() {
    if (panel) panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', panelEscape, true);
    launcher.focus();
  }

  function panelEscape(event) {
    if (event.key === 'Escape' && panel && !panel.hidden) {
      event.stopPropagation();
      closePanel();
    }
  }

  async function refresh() {
    const result = await api('/account/me');
    if (result.ok && result.data && result.data.username) {
      me = result.data;
      if (launcher) {
        const name = launcher.querySelector('.dsh-gate-launcher-name');
        if (name) name.textContent = me.username;
      }
      return true;
    }
    return false;
  }

  function mountLauncher() {
    if (launcher) return;
    launcher = el('button', 'dsh-gate-launcher');
    launcher.type = 'button';
    launcher.id = 'dsh-gate-launcher';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>';
    launcher.appendChild(el('span', 'dsh-gate-launcher-name', me.username));
    launcher.addEventListener('click', () => {
      if (panel && !panel.hidden) closePanel();
      else openPanel();
    });
    document.body.appendChild(launcher);
  }

  // ------------------------------------------------------------------- boot

  async function start() {
    renderLoading();
    const status = await api('/auth/status');
    if (!status.ok) {
      renderCard('login');
      const alert = overlay && overlay.querySelector('.dsh-gate-alert');
      if (alert) {
        alert.textContent = status.error === 'network' ? t('errNetwork') : errText(status.error);
        alert.hidden = false;
      }
      return;
    }
    const data = status.data || {};
    if (!data.hasAdmin) return renderCard('setup');
    if (!data.authenticated) return renderCard('login');
    if (!await refresh()) return renderCard('login');
    releaseTo(me.conversationId);
    mountLauncher();
  }

  // State always comes from the server: the session is an HttpOnly cookie this
  // script cannot read, so nothing here is cached in storage.
  async function begin() {
    await start();
    if (released && me === null && await refresh()) mountLauncher();
    else if (released && me !== null) mountLauncher();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
