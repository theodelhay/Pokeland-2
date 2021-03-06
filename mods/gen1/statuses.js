/**
 * Statuses worked way different.
 * Sleep lasted longer, had no reset on switch and took a whole turn to wake up.
 * Frozen only thaws when hit by fire or Haze.
 *
 * Secondary effects to status (-speed, -atk) worked differently, so they are
 * separated as volatile statuses that are applied on switch in, removed
 * under certain conditions and re-applied under other conditions.
 */

'use strict';

/**@type {{[k: string]: ModdedEffectData}} */
let BattleStatuses = {
	brn: {
		name: 'brn',
		id: 'brn',
		num: 0,
		effectType: 'Status',
		onStart: function (target) {
			this.add('-status', target, 'brn');
			target.addVolatile('brnattackdrop');
		},
		onAfterMoveSelfPriority: 2,
		onAfterMoveSelf: function (pokemon) {
			let toxicCounter = 1;
			if (pokemon.volatiles['residualdmg']) {
				pokemon.volatiles['residualdmg'].counter++;
				toxicCounter = pokemon.volatiles['residualdmg'].counter;
			}
			this.damage(this.clampIntRange(Math.floor(pokemon.maxhp / 16), 1) * toxicCounter, pokemon);
		},
		onSwitchIn: function (pokemon) {
			pokemon.addVolatile('brnattackdrop');
		},
		onAfterSwitchInSelf: function (pokemon) {
			this.damage(this.clampIntRange(Math.floor(pokemon.maxhp / 16), 1));
		},
	},
	par: {
		name: 'par',
		id: 'par',
		num: 0,
		effectType: 'Status',
		onStart: function (target) {
			this.add('-status', target, 'par');
			target.addVolatile('parspeeddrop');
		},
		onBeforeMovePriority: 2,
		onBeforeMove: function (pokemon) {
			if (this.randomChance(63, 256)) {
				this.add('cant', pokemon, 'par');
				pokemon.removeVolatile('bide');
				pokemon.removeVolatile('twoturnmove');
				pokemon.removeVolatile('fly');
				pokemon.removeVolatile('dig');
				pokemon.removeVolatile('solarbeam');
				pokemon.removeVolatile('skullbash');
				pokemon.removeVolatile('partialtrappinglock');
				return false;
			}
		},
		onSwitchIn: function (pokemon) {
			pokemon.addVolatile('parspeeddrop');
		},
	},
	slp: {
		name: 'slp',
		id: 'slp',
		num: 0,
		effectType: 'Status',
		onStart: function (target) {
			this.add('-status', target, 'slp');
			// 1-7 turns
			this.effectData.startTime = this.random(1, 8);
			this.effectData.time = this.effectData.startTime;
		},
		onBeforeMovePriority: 10,
		onBeforeMove: function (pokemon, target, move) {
			pokemon.statusData.time--;
			if (pokemon.statusData.time > 0) {
				this.add('cant', pokemon, 'slp');
			}
			pokemon.lastMove = null;
			return false;
		},
		onAfterMoveSelf: function (pokemon) {
			if (pokemon.statusData.time <= 0) pokemon.cureStatus();
		},
	},
	frz: {
		name: 'frz',
		id: 'frz',
		num: 0,
		effectType: 'Status',
		onStart: function (target) {
			this.add('-status', target, 'frz');
		},
		onBeforeMovePriority: 10,
		onBeforeMove: function (pokemon, target, move) {
			this.add('cant', pokemon, 'frz');
			pokemon.lastMove = null;
			return false;
		},
		onAfterMoveSecondary: function (target, source, move) {
			if (move.secondary && move.secondary.status === 'brn') {
				target.cureStatus();
			}
		},
	},
	psn: {
		name: 'psn',
		id: 'psn',
		num: 0,
		effectType: 'Status',
		onStart: function (target) {
			this.add('-status', target, 'psn');
		},
		onAfterMoveSelfPriority: 2,
		onAfterMoveSelf: function (pokemon) {
			let toxicCounter = 1;
			if (pokemon.volatiles['residualdmg']) {
				pokemon.volatiles['residualdmg'].counter++;
				toxicCounter = pokemon.volatiles['residualdmg'].counter;
			}
			this.damage(this.clampIntRange(Math.floor(pokemon.maxhp / 16), 1) * toxicCounter, pokemon);
		},
		onAfterSwitchInSelf: function (pokemon) {
			this.damage(this.clampIntRange(Math.floor(pokemon.maxhp / 16), 1));
		},
	},
	tox: {
		name: 'tox',
		id: 'tox',
		num: 0,
		effectType: 'Status',
		onStart: function (target) {
			this.add('-status', target, 'tox');
			if (!target.volatiles['residualdmg']) target.addVolatile('residualdmg');
			target.volatiles['residualdmg'].counter = 0;
		},
		onAfterMoveSelfPriority: 2,
		onAfterMoveSelf: function (pokemon) {
			pokemon.volatiles['residualdmg'].counter++;
			this.damage(this.clampIntRange(Math.floor(pokemon.maxhp / 16), 1) * pokemon.volatiles['residualdmg'].counter, pokemon, pokemon);
		},
		onSwitchIn: function (pokemon) {
			// Regular poison status and damage after a switchout -> switchin.
			pokemon.setStatus('psn');
		},
		onAfterSwitchInSelf: function (pokemon) {
			this.damage(this.clampIntRange(Math.floor(pokemon.maxhp / 16), 1));
		},
	},
	confusion: {
		name: 'confusion',
		id: 'confusion',
		num: 0,
		// this is a volatile status
		onStart: function (target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.id === 'lockedmove') {
				this.add('-start', target, 'confusion', '[silent]');
			} else {
				this.add('-start', target, 'confusion');
			}
			this.effectData.time = this.random(2, 6);
		},
		onEnd: function (target) {
			this.add('-end', target, 'confusion');
		},
		onBeforeMovePriority: 3,
		onBeforeMove: function (pokemon, target) {
			pokemon.volatiles.confusion.time--;
			if (!pokemon.volatiles.confusion.time) {
				pokemon.removeVolatile('confusion');
				return;
			}
			this.add('-activate', pokemon, 'confusion');
			if (!this.randomChance(128, 256)) {
				// We check here to implement the substitute bug since otherwise we need to change directDamage to take target.
				let damage = Math.floor(Math.floor(((Math.floor(2 * pokemon.level / 5) + 2) * pokemon.getStat('atk') * 40) / pokemon.getStat('def', false)) / 50) + 2;
				if (pokemon.volatiles['substitute']) {
					// If there is Substitute, we check for opposing substitute.
					if (target.volatiles['substitute']) {
						// Damage that one instead.
						this.directDamage(damage, target);
					}
				} else {
					// No substitute, direct damage to itself.
					this.directDamage(damage);
				}
				pokemon.removeVolatile('bide');
				pokemon.removeVolatile('twoturnmove');
				pokemon.removeVolatile('fly');
				pokemon.removeVolatile('dig');
				pokemon.removeVolatile('solarbeam');
				pokemon.removeVolatile('skullbash');
				pokemon.removeVolatile('partialtrappinglock');
				return false;
			}
			return;
		},
	},
	flinch: {
		name: 'flinch',
		id: 'flinch',
		num: 0,
		duration: 1,
		onBeforeMovePriority: 4,
		onBeforeMove: function (pokemon) {
			if (!this.runEvent('Flinch', pokemon)) {
				return;
			}
			this.add('cant', pokemon, 'flinch');
			return false;
		},
	},
	trapped: {
		name: 'trapped',
		id: 'trapped',
		num: 0,
		noCopy: true,
		onTrapPokemon: function (pokemon) {
			if (!this.effectData.source || !this.effectData.source.isActive) {
				delete pokemon.volatiles['trapped'];
				return;
			}
			pokemon.trapped = true;
		},
	},
	partiallytrapped: {
		name: 'partiallytrapped',
		id: 'partiallytrapped',
		num: 0,
		duration: 2,
		onBeforeMovePriority: 4,
		onBeforeMove: function (pokemon) {
			this.add('cant', pokemon, 'partiallytrapped');
			return false;
		},
	},
	partialtrappinglock: {
		name: 'partialtrappinglock',
		id: 'partialtrappinglock',
		num: 0,
		durationCallback: function () {
			let duration = this.sample([2, 2, 2, 3, 3, 3, 4, 5]);
			return duration;
		},
		onResidual: function (target) {
			if (target.lastMove && target.lastMove.id === 'struggle' || target.status === 'slp') {
				delete target.volatiles['partialtrappinglock'];
			}
		},
		onStart: function (target, source, effect) {
			this.effectData.move = effect.id;
		},
		onDisableMove: function (pokemon) {
			if (!pokemon.hasMove(this.effectData.move)) {
				return;
			}
			for (const moveSlot of pokemon.moveSlots) {
				if (moveSlot.id !== this.effectData.move) {
					pokemon.disableMove(moveSlot.id);
				}
			}
		},
	},
	lockedmove: {
		// Outrage, Thrash, Petal Dance...
		inherit: true,
		durationCallback: function () {
			return this.random(3, 5);
		},
	},
	stall: {
		name: 'stall',
		id: 'stall',
		num: 0,
		// Protect, Detect, Endure counter
		duration: 2,
		counterMax: 256,
		onStart: function () {
			this.effectData.counter = 2;
		},
		onStallMove: function () {
			// this.effectData.counter should never be undefined here.
			// However, just in case, use 1 if it is undefined.
			let counter = this.effectData.counter || 1;
			if (counter >= 256) {
				// 2^32 - special-cased because Battle.random(n) can't handle n > 2^16 - 1
				return (this.random() * 4294967296 < 1);
			}
			this.debug("Success chance: " + Math.round(100 / counter) + "%");
			return this.randomChance(1, counter);
		},
		onRestart: function () {
			// @ts-ignore
			if (this.effectData.counter < this.effect.counterMax) {
				this.effectData.counter *= 2;
			}
			this.effectData.duration = 2;
		},
	},
};

exports.BattleStatuses = BattleStatuses;
