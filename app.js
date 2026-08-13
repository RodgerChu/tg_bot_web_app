const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const STORAGE_KEY = 'dnd_weapons_v1';
const DAMAGE_TYPES = ['Кол.', 'Руб.', 'Дроб.', 'Некр.', 'Изл.', 'Кисл.', 'Сил.поле', 'Огонь', 'Вода', 'Лед', 'Холод', 'Молния', 'Гром', 'Яд', 'Псих', 'Свет', 'Тьма', 'Чист', 'Без типа'];
let weapons = {};
let currentTab = 'd20';
let damageEntries = [{ type: 'Без типа', formula: '' }];
let weaponFormEntries = [];
let editingName = null;
let d20ThresholdValues = [];
let d20ThresholdIndex = 0;

function loadWeapons() {
	const value = localStorage.getItem(STORAGE_KEY);
	if (value) {
		try { weapons = JSON.parse(value); } catch { weapons = {}; }
	} else {
		weapons = {};
	}

	for (const name in weapons) {
		if (typeof weapons[name] === 'string') {
			weapons[name] = [{ type: 'Без типа', formula: weapons[name] }];
		}
	}
}

function saveWeapons() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(weapons));
}

function showAlert(text) {
	tg.showAlert(text);
}

function rollDie(sides) {
	return Math.floor(Math.random() * sides) + 1;
}

function onD20RowClick(e) {
	const row = e.target.closest('.d20-row');
	if (!row || row.dataset.value === '1') return;
	const dc = parseInt(row.dataset.value, 10);
	if (isNaN(dc)) return;
	applyD20Threshold(dc);
}

function applyD20Threshold(dc) {
	const allRows = document.querySelectorAll('.d20-row');
	for (const r of allRows) {
		if (r.dataset.value === '1') continue;
		const val = parseInt(r.dataset.value, 10);
		if (val >= dc) {
			r.classList.add('hit');
			r.classList.remove('miss');
			r.textContent = 'Попадание: ' + val;
		} else {
			r.classList.add('miss');
			r.classList.remove('hit');
			r.textContent = 'Промах: ' + val;
		}
	}
	updateD20ThresholdDisplay(dc);
	updateD20Counter();
}

function updateD20ThresholdDisplay(dc) {
	const control = document.getElementById('d20control');
	if (!control) return;
	if (dc !== undefined) {
		const idx = d20ThresholdValues.indexOf(dc);
		if (idx !== -1) d20ThresholdIndex = idx;
	}
	const value = d20ThresholdValues[d20ThresholdIndex];
	const textEl = control.querySelector('.d20-threshold');
	if (textEl) textEl.textContent = (value !== undefined ? value : '—');
}

function updateD20Counter() {
	const counter = document.getElementById('d20counter');
	if (!counter) return;
	const hits = document.querySelectorAll('.d20-row.hit').length;
	const misses = document.querySelectorAll('.d20-row.miss').length;
	counter.textContent = 'Попаданий: ' + hits + ' | Промахов: ' + misses;
}

function findDiceIndex(token) {
	for (let i = 0; i < token.length; i++) {
		const ch = token[i].toLowerCase();
		if (ch === 'd' || ch === 'д') return i;
	}
	return -1;
}

function parseDamage(formula) {
	const terms = [];
	const clean = formula.replace(/ /g, '').replace(/[+]/g, ' + ').replace(/[-]/g, ' - ').trim();
	if (!clean) return terms;

	const tokens = clean.split(/ /);
	let sign = 1;

	for (const token of tokens) {
		if (token === '+') { sign = 1; continue; }
		if (token === '-') { sign = -1; continue; }
		if (!token) continue;

		const dIndex = findDiceIndex(token);
		if (dIndex === -1) {
			const constant = parseInt(token, 10);
			if (!isNaN(constant)) {
				terms.push({ sign, count: 0, sides: 0, constant });
			}
		} else {
			const count = parseInt(token.substring(0, dIndex), 10);
			const sides = parseInt(token.substring(dIndex + 1), 10);
			if (!isNaN(count) && !isNaN(sides) && sides > 0) {
				terms.push({ sign, count, sides, constant: 0 });
			}
		}
		sign = 1;
	}
	return terms;
}

function rollDamage(formula, attacks) {
	const terms = parseDamage(formula);
	const attackResults = [];
	let total = 0;

	for (let a = 0; a < attacks; a++) {
		const termRolls = [];
		let perAttack = 0;

		for (const t of terms) {
			if (t.sides === 0) {
				const constantTotal = t.sign * t.constant;
				const termLabel = (t.sign > 0 ? '+' : '-') + t.constant;
				termRolls.push({ term: termLabel, rolls: [], termTotal: constantTotal });
				perAttack += constantTotal;
			} else {
				const rolls = [];
				let sum = 0;
				for (let r = 0; r < t.count; r++) {
					const roll = rollDie(t.sides);
					rolls.push(roll);
					sum += roll;
				}
				const termTotal = t.sign * sum;
				termRolls.push({ term: t.count + 'd' + t.sides, rolls, termTotal });
				perAttack += termTotal;
			}
		}

		attackResults.push({ terms: termRolls, perAttackTotal: perAttack });
		total += perAttack;
	}

	return { attacks: attackResults, total };
}

function openModal(title, html) {
	document.getElementById('modal-title').textContent = title;
	document.getElementById('modal-content').innerHTML = html;
	document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
	document.getElementById('modal').classList.add('hidden');
}

function getInt(id, defaultValue) {
	const v = parseInt(document.getElementById(id).value, 10);
	return isNaN(v) ? defaultValue : v;
}

function getValue(id) {
	return document.getElementById(id).value.trim();
}

function setActiveMode(value) {
	document.querySelectorAll('.mode button').forEach(b => {
		b.classList.toggle('active', b.dataset.mode === value);
	});
}

function renderD20() {
	const content = document.getElementById('content');
	content.innerHTML = '<div class=\'section\'>' +
		'<div class=\'section-title\'>Бросок d20</div>' +
		'<div class=\'mode\' id=\'d20mode\'>' +
			'<button data-mode=\'normal\' class=\'active\' onclick=\'setD20Mode("normal")\'>Обычный</button>' +
			'<button data-mode=\'advantage\' onclick=\'setD20Mode("advantage")\'>Преим.</button>' +
			'<button data-mode=\'disadvantage\' onclick=\'setD20Mode("disadvantage")\'>Помеха</button>' +
			'<button data-mode=\'elven\' onclick=\'setD20Mode("elven")\'>Эльф. точность</button>' +
		'</div>' +
		'<input type=\'hidden\' id=\'d20modeValue\' value=\'normal\'>' +
		'<div class=\'row\'>' +
			'<div class=\'input-col\'>' +
				'<label class=\'input-label\'>Кол-во бросков</label>' +
				'<input type=\'number\' id=\'d20count\' value=\'1\' min=\'1\'>' +
			'</div>' +
			'<div class=\'input-col\'>' +
				'<label class=\'input-label\'>Модификатор</label>' +
				'<input type=\'number\' id=\'d20mod\' value=\'0\'>' +
			'</div>' +
		'</div>' +
		'<button onclick=\'doD20Roll()\'>Бросить</button>' +
	'</div>';
}

function setD20Mode(mode) {
	document.getElementById('d20modeValue').value = mode;
	setActiveMode(mode);
}

function doD20Roll() {
	const mode = document.getElementById('d20modeValue').value;
	const count = getInt('d20count', 1);
	const modifier = getInt('d20mod', 0);
	openModal('Результат броска d20', '<div class=\'d20-result\' id=\'d20result\'></div><div class=\'d20-counter\' id=\'d20counter\'></div><div id=\'d20control\'></div>');
	runD20Sequence(count, mode, modifier);
}

function runD20Sequence(count, mode, modifier) {
	const container = document.getElementById('d20result');
	if (!container) return;
	const perDie = mode === 'advantage' || mode === 'disadvantage' ? 2 : mode === 'elven' ? 3 : 1;
	let i = 0;
	const rows = [];
	const next = () => {
		if (i >= count) {
			if (modifier !== 0) {
				const sum = rows.reduce((a, v) => a + v, 0) + modifier;
				const total = document.createElement('div');
				total.className = 'd20-total';
				total.textContent = 'Сумма: ' + sum;
				container.appendChild(total);
			}
			renderD20Control(rows);
			updateD20Counter();
			return;
		}
		const rolls = [];
		for (let j = 0; j < perDie; j++) {
			rolls.push(rollDie(20));
		}
		const selected = mode === 'disadvantage' ? Math.min(...rolls) : Math.max(...rolls);
		rows.push(selected);
		let label = (i + 1) + '. ';
		if (selected === 1 || selected === 20) {
			label += 'Крит. ' + selected;
		} else if (rolls.length > 1) {
			label += '(' + rolls.join(', ') + ') → ' + selected;
		} else {
			label += selected;
		}
		const row = document.createElement('div');
		row.className = 'd20-row';
		row.dataset.value = selected;
		row.textContent = label;
		if (selected === 1) {
			row.classList.add('miss');
			container.appendChild(row);
			renderD20Control(rows);
			updateD20Counter();
			return;
		}
		container.appendChild(row);
		i++;
		setTimeout(next, 150);
	};
	next();
}

function renderD20Control(rows) {
	const control = document.getElementById('d20control');
	if (!control) return;
	const unique = [];
	for (const v of rows) {
		if (v !== 1 && !unique.includes(v)) unique.push(v);
	}
	unique.sort((a, b) => a - b);
	d20ThresholdValues = unique;
	d20ThresholdIndex = 0;

	if (unique.length === 0) {
		control.innerHTML = '<div class=\'d20-control\'>Нет бросков кроме 1</div>';
		return;
	}

	control.innerHTML = '<div class=\'d20-control\'>' +
		'<button class=\'d20-minus\' data-action=\'d20-minus\' ' + (d20ThresholdIndex >= unique.length - 1 ? 'disabled' : '') + '>−</button>' +
		'<div class=\'d20-threshold\'>' + unique[0] + '</div>' +
		'<button class=\'d20-plus\' data-action=\'d20-plus\' ' + (d20ThresholdIndex <= 0 ? 'disabled' : '') + '>+</button>' +
	'</div>';
}

function stepD20Threshold(direction) {
	if (!d20ThresholdValues.length) return;
	const newIndex = d20ThresholdIndex + direction;
	if (newIndex < 0 || newIndex >= d20ThresholdValues.length) return;
	d20ThresholdIndex = newIndex;
	const dc = d20ThresholdValues[d20ThresholdIndex];
	applyD20Threshold(dc);

	const control = document.getElementById('d20control');
	if (!control) return;
	const minus = control.querySelector('.d20-minus');
	const plus = control.querySelector('.d20-plus');
	if (minus) minus.disabled = d20ThresholdIndex >= d20ThresholdValues.length - 1;
	if (plus) plus.disabled = d20ThresholdIndex <= 0;
}

function escapeHtml(text) {
	if (text === null || text === undefined) return '';
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function renderTypeOptions(selected) {
	let html = '';
	for (const t of DAMAGE_TYPES) {
		html += '<option value=\'' + escapeHtml(t) + '\'' + (t === selected ? ' selected' : '') + '>' + escapeHtml(t) + '</option>';
	}
	return html;
}

function readFormEntries(containerId) {
	const rows = document.querySelectorAll('#' + containerId + ' .form-row');
	const entries = [];
	for (const row of rows) {
		const type = row.querySelector('.damage-type').value;
		const formula = row.querySelector('.damage-formula').value.trim();
		if (type) entries.push({ type, formula });
	}
	return entries;
}

function renderEntries(containerId, entries, context) {
	const container = document.getElementById(containerId);
	if (!container) return;
	let html = '';
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		html += '<div class=\'form-row\' data-context=\'' + context + '\' data-index=\'' + i + '\'>' +
			'<select class=\'damage-type\'>' + renderTypeOptions(e.type) + '</select>' +
			'<input type=\'text\' class=\'damage-formula\' placeholder=\'2d6+3\' value=\'' + escapeHtml(e.formula) + '\'>' +
			'<button class=\'danger remove-row\' data-action=\'remove-row\' data-context=\'' + context + '\' data-index=\'' + i + '\' data-default=\'✕\'>✕</button>' +
		'</div>';
	}
	container.innerHTML = html;
}

function renderDamage() {
	const content = document.getElementById('content');
	content.innerHTML = '<div class=\'section\'>' +
		'<div class=\'section-title\'>Урон атаки</div>' +
		'<div class=\'input-stack\'>' +
			'<label class=\'input-label\'>Кол-во атак</label>' +
			'<input type=\'number\' id=\'attacks\' value=\'1\' min=\'1\'>' +
		'</div>' +
		'<div class=\'section-title\' style=\'margin-top: 12px;\'>Формулы урона</div>' +
		'<div id=\'damageEntriesContainer\' class=\'entries-list\'></div>' +
		'<button class=\'secondary\' data-action=\'add-row\' data-context=\'damage\' style=\'margin-top: 8px;\'>Добавить урон</button>' +
		'<div class=\'row\' style=\'margin-top: 12px;\'>' +
			'<button onclick=\'doDamageRoll()\'>Посчитать</button>' +
			'<button class=\'secondary\' onclick=\'openWeaponSelect()\'>Выбрать оружие</button>' +
		'</div>' +
	'</div>';
	renderEntries('damageEntriesContainer', damageEntries, 'damage');
}

function doDamageRoll() {
	const attacks = getInt('attacks', 1);
	damageEntries = readFormEntries('damageEntriesContainer');

	let hasFormula = false;
	for (const e of damageEntries) {
		if (e.formula) hasFormula = true;
	}
	if (!hasFormula) {
		showAlert('Введи хотя бы одну формулу урона.');
		return;
	}

	for (const e of damageEntries) {
		if (!e.formula) continue;
		const terms = parseDamage(e.formula);
		if (terms.length === 0) {
			showAlert('Не удалось распознать формулу: ' + e.formula);
			return;
		}
	}

	const result = rollDamageSet(damageEntries, attacks);
	openModal('Результат урона', '<pre>' + escapeHtml(formatDamageSet(result, attacks)) + '</pre>');
}

function rollDamageSet(entries, attacks) {
	const entryResults = [];
	for (const e of entries) {
		entryResults.push({ type: e.type, result: rollDamage(e.formula, attacks) });
	}

	const typeSet = new Set();
	const typeTotals = {};
	const attackResults = [];

	for (let a = 0; a < attacks; a++) {
		const byType = {};
		let attackTotal = 0;

		for (const er of entryResults) {
			const value = er.result.attacks[a].perAttackTotal;
			byType[er.type] = (byType[er.type] || 0) + value;
			attackTotal += value;
		}

		attackResults.push({ byType, total: attackTotal });
		for (const t in byType) {
			typeSet.add(t);
			typeTotals[t] = (typeTotals[t] || 0) + byType[t];
		}
	}

	const typeOrder = Array.from(typeSet).sort((a, b) => DAMAGE_TYPES.indexOf(a) - DAMAGE_TYPES.indexOf(b));
	let total = 0;
	for (const t of typeOrder) total += typeTotals[t];

	return { attacks: attackResults, typeTotals, typeOrder, total };
}

function formatDamageSet(result, attacks) {
	let s = 'Атак: ' + attacks + '\n\n';
	for (let i = 0; i < result.attacks.length; i++) {
		const attack = result.attacks[i];
		s += 'Атака ' + (i + 1) + ':\n';
		for (const type of result.typeOrder) {
			if (attack.byType[type] !== undefined) {
				s += '  ' + type + ': ' + attack.byType[type] + '\n';
			}
		}
		s += '  Итого: ' + attack.total + '\n';
	}
	s += '\nВсего:\n';
	for (const type of result.typeOrder) {
		s += '  ' + type + ': ' + result.typeTotals[type] + '\n';
	}
	s += '  Общий итог: ' + result.total;
	return s;
}

function openWeaponSelect() {
	const names = Object.keys(weapons).sort();
	if (names.length === 0) {
		showAlert('Нет сохранённого оружия. Добавь в разделе "Оружие".');
		return;
	}

	let html = '<div class=\'hint\'>Отметь оружие и нажми "Добавить":</div>';
	for (const name of names) {
		const entriesText = weapons[name].map(e => escapeHtml(e.type) + ': ' + escapeHtml(e.formula)).join(', ');
		html += '<label class=\'modal-check\'>' +
			'<input type=\'checkbox\' value=\'' + escapeHtml(name) + '\' name=\'sel_weapon\'>' +
			'<span>' + escapeHtml(name) + ' (' + entriesText + ')</span>' +
		'</label>';
	}
	html += '<button data-action=\'add-weapons\'>Добавить</button>';
	openModal('Выбор оружия', html);
}

function addSelectedWeapons() {
	const selected = Array.from(document.querySelectorAll('input[name=sel_weapon]:checked')).map(i => i.value);
	if (selected.length === 0) {
		showAlert('Выбери хотя бы одно оружие.');
		return;
	}
	for (const name of selected) {
		if (weapons[name]) {
			for (const e of weapons[name]) {
				damageEntries.push({ type: e.type, formula: e.formula });
			}
		}
	}
	closeModal();
	showTab('damage');
}

function renderWeapons() {
	const names = Object.keys(weapons).sort();
	let listHtml = '';
	if (names.length === 0) {
		listHtml = '<div class=\'empty\'>Оружие не добавлено</div>';
	} else {
		for (const name of names) {
			const entriesText = weapons[name].map(e => escapeHtml(e.type) + ': ' + escapeHtml(e.formula)).join(', ');
			listHtml += '<div class=\'weapon-item\'>' +
				'<div class=\'weapon-item-info\'>' +
					'<div class=\'weapon-name\'>' + escapeHtml(name) + '</div>' +
					'<div class=\'weapon-formula\'>' + entriesText + '</div>' +
				'</div>' +
				'<div class=\'weapon-actions\'>' +
					'<button class=\'secondary\' data-name=\'' + escapeHtml(name) + '\' data-action=\'edit\'>Изменить</button>' +
					'<button class=\'danger\' data-name=\'' + escapeHtml(name) + '\' data-action=\'delete\'>Удалить</button>' +
				'</div>' +
			'</div>';
		}
	}

	const isEditing = editingName !== null;
	const title = isEditing ? 'Изменить оружие' : 'Добавить оружие';
	const btnText = isEditing ? 'Сохранить' : 'Добавить';
	const content = document.getElementById('content');
	content.innerHTML = '<div class=\'section\'>' +
		'<div class=\'section-title\'>Мои оружия</div>' +
		listHtml +
	'</div>' +
	'<div class=\'section\'>' +
		'<div class=\'section-title\'>' + title + '</div>' +
		'<div class=\'input-stack\'>' +
			'<label class=\'input-label\'>Название</label>' +
			'<input type=\'text\' id=\'weaponName\' placeholder=\'Например, Длинный меч\' value=\'' + (isEditing ? escapeHtml(editingName) : '') + '\'>' +
		'</div>' +
		'<div class=\'section-title\' style=\'margin-top: 12px;\'>Формулы урона</div>' +
		'<div id=\'weaponEntriesContainer\' class=\'entries-list\'></div>' +
		'<button class=\'secondary\' data-action=\'add-row\' data-context=\'weapon\' style=\'margin-top: 8px;\'>Добавить урон</button>' +
		'<button id=\'addWeaponBtn\' style=\'margin-top: 12px;\' onclick=\'addWeapon()\'>' + btnText + '</button>' +
	'</div>';

	if (isEditing) {
		weaponFormEntries = weapons[editingName].map(e => ({...e}));
	} else {
		if (weaponFormEntries.length === 0) weaponFormEntries = [{ type: 'Без типа', formula: '' }];
	}
	renderEntries('weaponEntriesContainer', weaponFormEntries, 'weapon');
}

function addWeapon() {
	const name = getValue('weaponName');
	if (!name) {
		showAlert('Нужно название оружия.');
		return;
	}

	weaponFormEntries = readFormEntries('weaponEntriesContainer');
	if (weaponFormEntries.length === 0) {
		showAlert('Добавь хотя бы одну формулу урона.');
		return;
	}

	for (const e of weaponFormEntries) {
		if (!e.formula) {
			showAlert('Заполни все формулы или удали пустую строку.');
			return;
		}
		const terms = parseDamage(e.formula);
		if (terms.length === 0) {
			showAlert('Не удалось распознать формулу: ' + e.formula);
			return;
		}
	}

	if (editingName && editingName !== name) {
		delete weapons[editingName];
	}

	editingName = null;
	weapons[name] = weaponFormEntries;
	weaponFormEntries = [];
	saveWeapons();
	renderWeapons();
}

function editWeapon(name) {
	editingName = name;
	weaponFormEntries = weapons[name].map(e => ({...e}));
	renderWeapons();
}

function deleteWeapon(name) {
	delete weapons[name];
	if (editingName === name) {
		editingName = null;
		weaponFormEntries = [];
	}
	saveWeapons();
	renderWeapons();
}

function addEntry(context) {
	const containerId = context === 'damage' ? 'damageEntriesContainer' : 'weaponEntriesContainer';
	const entries = readFormEntries(containerId);
	entries.push({ type: 'Без типа', formula: '' });
	if (context === 'damage') damageEntries = entries;
	else weaponFormEntries = entries;
	renderEntries(containerId, entries, context);
}

function removeEntry(context, index) {
	const containerId = context === 'damage' ? 'damageEntriesContainer' : 'weaponEntriesContainer';
	const entries = readFormEntries(containerId);
	entries.splice(index, 1);
	if (entries.length === 0) entries.push({ type: 'Без типа', formula: '' });
	if (context === 'damage') damageEntries = entries;
	else weaponFormEntries = entries;
	renderEntries(containerId, entries, context);
}

function handleRemoveRowClick(btn) {
	if (btn.dataset.confirm === '1') {
		removeEntry(btn.dataset.context, parseInt(btn.dataset.index, 10));
	} else {
		btn.dataset.confirm = '1';
		btn.textContent = 'Удалить';
		btn.classList.add('confirming');
		setTimeout(() => {
			if (btn) {
				btn.dataset.confirm = '0';
				btn.textContent = btn.dataset.default || '✕';
				btn.classList.remove('confirming');
			}
		}, 5000);
	}
}

function showTab(tab) {
	currentTab = tab;
	document.querySelectorAll('.tab-btn').forEach(b => {
		b.classList.toggle('active', b.dataset.tab === tab);
	});
	if (tab === 'd20') renderD20();
	else if (tab === 'damage') renderDamage();
	else if (tab === 'weapons') renderWeapons();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
	btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

document.getElementById('content').addEventListener('click', (e) => {
	const btn = e.target.closest('button[data-action]');
	if (!btn) return;
	const action = btn.dataset.action;
	const name = btn.dataset.name;
	if (action === 'delete') deleteWeapon(name);
	else if (action === 'edit') editWeapon(name);
	else if (action === 'add-row') addEntry(btn.dataset.context);
	else if (action === 'remove-row') handleRemoveRowClick(btn);
});

document.getElementById('modal-back').addEventListener('click', closeModal);
document.getElementById('modal-content').addEventListener('click', (e) => {
	const d20Row = e.target.closest('.d20-row');
	if (d20Row) {
		onD20RowClick(e);
		return;
	}
	const btn = e.target.closest('button[data-action]');
	if (!btn) return;
	if (btn.dataset.action === 'add-weapons') addSelectedWeapons();
	else if (btn.dataset.action === 'd20-minus') stepD20Threshold(1);
	else if (btn.dataset.action === 'd20-plus') stepD20Threshold(-1);
});

loadWeapons();
showTab('d20');
