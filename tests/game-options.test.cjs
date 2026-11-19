const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const gameScript = readFileSync(join(__dirname, '../js/game.js'), 'utf8');
const cropNames = ['논벼', '밭벼', '콩', '옥수수', '토란'];

function makeElement() {
    const classes = new Set();
    const handlers = new Map();

    return {
        disabled: false,
        children: [],
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name),
        },
        style: { removeProperty() {} },
        addEventListener: (type, handler) => handlers.set(type, handler),
        click() {
            if (!this.disabled) {
                handlers.get('click')?.();
            }
        },
        insertBefore(child, reference) {
            const index = this.children.indexOf(reference);
            assert.notEqual(index, -1);
            this.children.splice(index, 0, child);
            child.remove = () => this.children.splice(this.children.indexOf(child), 1);
        },
        querySelectorAll(selector) {
            return this.children.filter(child => child.classList.contains(selector.slice(1)));
        },
    };
}

function launchGame(names, { random = () => 0.5, count = 'all' } = {}) {
    const elements = new Map();
    const timers = new Map();
    let timerId = 0;
    let now = 0;
    let initialize;
    const get = id => {
        if (!elements.has(id)) {
            elements.set(id, makeElement());
        }
        return elements.get(id);
    };
    get('options-container').children.push(get('feedback-overlay'));
    get('quiz-area').classList.add('hidden');

    const context = vm.createContext({
        gameData: names.map((name, index) => ({ image_path: `${index}.png`, texts: { text: name } })),
        document: {
            getElementById: get,
            querySelector: selector => selector === '.image-stage' ? get('image-stage') : { value: count },
            createElement: makeElement,
            addEventListener: (_, handler) => { initialize = handler; },
        },
        window: { addEventListener() {} },
        Date: { now: () => now },
        Math: Object.assign(Object.create(Math), { random }),
        setTimeout() {},
        clearTimeout() {},
        setInterval(handler) {
            timers.set(++timerId, handler);
            return timerId;
        },
        clearInterval(id) {
            timers.delete(id);
        },
        initialize: () => initialize(),
        click: id => get(id).click(),
    });
    vm.runInContext(gameScript, context);
    const run = script => vm.runInContext(script, context, { timeout: 1000 });
    run('initialize()');

    return {
        get,
        click: id => run(`click(${JSON.stringify(id)})`),
        options: () => get('options-container').querySelectorAll('.option-btn'),
        timerCount: () => timers.size,
        advance(seconds) {
            now += seconds * 1000;
            for (const handler of timers.values()) {
                handler();
            }
        },
    };
}

for (const distinct of [1, 2, 3]) {
    test(`6 questions with ${distinct} distinct answer names stop before starting`, () => {
        const names = Array.from({ length: 6 }, (_, index) => cropNames[index % distinct]);
        const app = launchGame(names);

        app.click('start-btn');
        assert.equal(app.get('start-btn').disabled, true);
        assert.equal(app.get('start-btn').textContent, '서로 다른 정답 4종 필요');
        assert.equal(app.get('quiz-area').classList.contains('hidden'), true);
        assert.equal(app.options().length, 0);
        assert.equal(app.timerCount(), 0);
    });
}

test('whitespace variants of the same answer do not count as separate names', () => {
    const app = launchGame(['논벼', ' 논벼 ', '밭벼', '찰 옥수수', '찰\t옥수수', '  ', undefined]);
    assert.equal(app.get('start-btn').disabled, true);
});

test('exactly four names produce four distinct options for every question', () => {
    const names = ['논벼', '밭벼', '콩', '옥수수', '논벼', '밭벼'];
    const app = launchGame(names);
    assert.equal(app.get('start-btn').disabled, false);
    app.click('start-btn');

    for (const [index, name] of names.entries()) {
        assert.equal(app.get('question-number').textContent, index + 1);
        const options = app.options().map(button => button.innerText);
        assert.equal(options.length, 4);
        assert.deepEqual(new Set(options), new Set(cropNames.slice(0, 4)));
        assert.equal(options.filter(option => option === name).length, 1);
        app.click('next-btn');
    }

    assert.equal(app.get('game-over-area').classList.contains('hidden'), false);
    app.click('restart-btn');
    assert.equal(app.get('start-btn').disabled, false);
    app.click('start-btn');
    assert.equal(app.options().length, 4);
});

test('more than four names yield one correct option and three distinct distractors', () => {
    let randomState = 7;
    const app = launchGame(cropNames, {
        random: () => {
            randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
            return randomState / 2 ** 32;
        },
    });
    app.click('start-btn');

    for (let index = 0; index < cropNames.length; index++) {
        const correctName = cropNames[parseInt(app.get('quiz-image').src, 10)];
        const options = app.options().map(button => button.innerText);
        assert.equal(options.length, 4);
        assert.equal(new Set(options).size, 4);
        assert.equal(options.filter(option => option === correctName).length, 1);
        assert.ok(options.every(option => cropNames.includes(option)));
        app.click('next-btn');
    }
});

test('the selected question limit does not limit the pool of distractors', () => {
    const names = [...Array(10).fill(cropNames[0]), ...cropNames.slice(1, 4)];
    const app = launchGame(names, { count: '10' });
    app.click('start-btn');

    assert.equal(app.get('total-questions').textContent, 10);
    assert.deepEqual(new Set(app.options().map(button => button.innerText)), new Set(cropNames.slice(0, 4)));
});

test('correct answers retain the 3/2/1-point time thresholds', () => {
    for (const [elapsed, expected] of [[0, 3], [4, 3], [5, 2], [9, 2], [10, 1], [14, 1]]) {
        const app = launchGame([' 논벼 ', ...cropNames.slice(1, 4)]);
        app.click('start-btn');
        assert.equal(app.get('time-left').textContent, 15);
        app.advance(elapsed);
        app.options().find(button => button.innerText === '논벼').click();
        assert.equal(app.get('score').textContent, expected);
        assert.equal(app.timerCount(), 0);
    }
});

test('wrong answers and timeouts leave the final score at zero', () => {
    const app = launchGame(cropNames.slice(0, 4));
    app.click('start-btn');
    app.options().find(button => button.innerText === '밭벼').click();
    assert.match(app.get('feedback').textContent, /오답/);
    app.click('next-btn');
    app.advance(15);
    assert.match(app.get('feedback').textContent, /시간 초과/);
    assert.equal(app.timerCount(), 0);
    app.click('next-btn');
    app.click('next-btn');
    app.click('next-btn');
    assert.equal(app.get('final-score').textContent, 0);
});
