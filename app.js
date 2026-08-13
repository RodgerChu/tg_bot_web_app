const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const STORAGE_KEY = 'dnd_weapons_v1';
let weapons = {};
let currentTab = 'd20';
let damageSelectedWeapons = [];
let editingName = null;

function loadWeapons() {
	const value = localStorage.getItem(STORAGE_KEY);
	if (value) {
		try { weapons = JSON.parse(value); } catch { weapons = {}; }
	} else {
		weapons = {};
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
	updateD20Counter();
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

function formatDamage(result, formula, attacks) {
	let s = 'Формула: ' + formula + '\n';
	s += 'Атак: ' + attacks + '\n\n';
	for (let i = 0; i < result.attacks.length; i++) {
		const attack = result.attacks[i];
		s += 'Атака ' + (i + 1) + ':\n';
		for (const term of attack.terms) {
			if (term.rolls.length === 0) {
				s += '  ' + term.term + ': ' + term.termTotal + '\n';
			} else {
				s += '  ' + term.term + ': (' + term.rolls.join(', ') + ') = ' + term.termTotal + '\n';
			}
		}
		s += '  Итого: ' + attack.perAttackTotal + '\n';
	}
	s += '\nВсего: ' + result.total;
	return s;
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
	openModal('Результат броска d20', '<div class=\'d20-result\' id=\'d20result\'></div><div class=\'d20-counter\' id=\'d20counter\'></div>');
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
			updateD20Counter();
			return;
		}
		container.appendChild(row);
		i++;
		setTimeout(next, 150);
	};
	next();
}

function renderDamage() {
	const content = document.getElementById('content');
	content.innerHTML = '<div class=\'section\'>' +
		'<div class=\'section-title\'>Урон атаки</div>' +
		'<div class=\'row\'>' +
			'<div class=\'input-col\'>' +
				'<label class=\'input-label\'>Кол-во атак</label>' +
				'<input type=\'number\' id=\'attacks\' value=\'1\' min=\'1\'>' +
			'</div>' +
			'<div class=\'input-col\'>' +
				'<label class=\'input-label\'>Урон атаки</label>' +
				'<input type=\'text\' id=\'damage\' placeholder=\'2d6+3\'>' +
			'</div>' +
		'</div>' +
		'<div class=\'hint\'>Можно: 2d6+1d4+3-1. Разделитель d/д.</div>' +
		'<div class=\'row\'>' +
			'<button onclick=\'doDamageRoll()\'>Посчитать</button>' +
			'<button class=\'secondary\' onclick=\'openWeaponSelect()\'>Выбрать оружие</button>' +
		'</div>' +
	'</div>';
}

function doDamageRoll() {
	const attacks = getInt('attacks', 1);
	const formula = getValue('damage');
	if (!formula) {
		showAlert('Введи формулу урона.');
		return;
	}
	const terms = parseDamage(formula);
	if (terms.length === 0) {
		showAlert('Не удалось распознать формулу.');
		return;
	}
	const result = rollDamage(formula, attacks);
	openModal('Результат урона', '<pre>' + escapeHtml(formatDamage(result, formula, attacks)) + '</pre>');
}

function buildCombinedFormula(manual, selectedNames) {
	let parts = [];
	const manualTrim = manual.trim();
	if (manualTrim) parts.push(manualTrim);
	for (const name of selectedNames) {
		const formula = weapons[name];
		if (formula) parts.push(formula);
	}
	return parts.join(' + ');
}

function openWeaponSelect() {
	const names = Object.keys(weapons).sort();
	if (names.length === 0) {
		showAlert('Нет сохранённого оружия. Добавь в разделе "Оружие".');
		return;
	}

	let html = '<div class=\'hint\'>Отметь оружие и нажми "Подсчитать":</div>';
	for (const name of names) {
		html += '<label class=\'modal-check\'>' +
			'<input type=\'checkbox\' value=\'' + escapeHtml(name) + '\' name=\'sel_weapon\'>' +
			'<span>' + escapeHtml(name) + ' (' + escapeHtml(weapons[name]) + ')</span>' +
		'</label>';
	}
	html += '<button onclick=\'calculateWithWeapons()\'>Подсчитать</button>';
	openModal('Выбор оружия', html);
}

function calculateWithWeapons() {
	const attacks = getInt('attacks', 1);
	const manual = getValue('damage');
	const selected = Array.from(document.querySelectorAll('input[name=sel_weapon]:checked')).map(i => i.value);
	const formula = buildCombinedFormula(manual, selected);
	if (!formula) {
		showAlert('Выбери оружие или введи формулу.');
		return;
	}
	const terms = parseDamage(formula);
	if (terms.length === 0) {
		showAlert('Не удалось распознать формулу.');
		return;
	}
	const result = rollDamage(formula, attacks);
	openModal('Результат урона', '<pre>' + escapeHtml(formatDamage(result, formula, attacks)) + '</pre>');
}

function renderWeapons() {
	const names = Object.keys(weapons).sort();
	let listHtml = '';
	if (names.length === 0) {
		listHtml = '<div class=\'empty\'>Оружие не добавлено</div>';
	} else {
		for (const name of names) {
			listHtml += '<div class=\'weapon-item\'>' +
				'<div class=\'weapon-item-info\'>' +
					'<div class=\'weapon-name\'>' + escapeHtml(name) + '</div>' +
					'<div class=\'weapon-formula\'>' + escapeHtml(weapons[name]) + '</div>' +
				'</div>' +
				'<div class=\'weapon-actions\'>' +
					'<button class=\'secondary\' data-name=\'' + escapeHtml(name) + '\' data-action=\'edit\'>Изменить</button>' +
					'<button class=\'danger\' data-name=\'' + escapeHtml(name) + '\' data-action=\'delete\'>Удалить</button>' +
				'</div>' +
			'</div>';
		}
	}

	const content = document.getElementById('content');
	const isEditing = editingName !== null;
	const editName = isEditing ? escapeHtml(editingName) : '';
	const editFormula = isEditing ? escapeHtml(weapons[editingName]) : '';
	const title = isEditing ? 'Изменить оружие' : 'Добавить оружие';
	const btnText = isEditing ? 'Сохранить' : 'Добавить';
	content.innerHTML = '<div class=\'section\'>' +
		'<div class=\'section-title\'>Мои оружия</div>' +
		listHtml +
	'</div>' +
	'<div class=\'section\'>' +
		'<div class=\'section-title\'>' + title + '</div>' +
		'<div class=\'input-stack\'>' +
			'<label class=\'input-label\'>Название</label>' +
			'<input type=\'text\' id=\'weaponName\' placeholder=\'Например, Длинный меч\' value=\'' + editName + '\'>' +
			'<label class=\'input-label\'>Урон</label>' +
			'<input type=\'text\' id=\'weaponFormula\' placeholder=\'Например, 2d6+3\' value=\'' + editFormula + '\'>' +
		'</div>' +
		'<button id=\'addWeaponBtn\' onclick=\'addWeapon()\'>' + btnText + '</button>' +
	'</div>';
}

function addWeapon() {
	const name = getValue('weaponName');
	const formula = getValue('weaponFormula');
	if (!name || !formula) {
		showAlert('Нужны название и формула');
		return;
	}
	const terms = parseDamage(formula);
	if (terms.length === 0) {
		showAlert('Не удалось распознать формулу урона.');
		return;
	}
	if (editingName && editingName !== name) {
		delete weapons[editingName];
	}
	editingName = null;
	weapons[name] = formula;
	saveWeapons();
	document.getElementById('weaponName').value = '';
	document.getElementById('weaponFormula').value = '';
	renderWeapons();
}

function editWeapon(name) {
	editingName = name;
	renderWeapons();
}

function deleteWeapon(name) {
	delete weapons[name];
	if (editingName === name) {
		editingName = null;
	}
	saveWeapons();
	renderWeapons();
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

function escapeHtml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
	btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

document.getElementById('content').addEventListener('click', (e) => {
	const btn = e.target.closest('button[data-action]');
	if (!btn) return;
	const name = btn.dataset.name;
	if (btn.dataset.action === 'delete') deleteWeapon(name);
	else if (btn.dataset.action === 'edit') editWeapon(name);
});

document.getElementById('modal-back').addEventListener('click', closeModal);
document.getElementById('modal-content').addEventListener('click', onD20RowClick);

loadWeapons();
showTab('d20');
