import { isNumeric } from '@awayfl/swf-loader';
import { Multiname } from '../abc/lazy/Multiname';
import { RuntimeTraits } from '../abc/lazy/RuntimeTraits';
import { TRAIT } from '../abc/lazy/TRAIT';
import { ASObject } from '../nat/ASObject';
import { IS_EXTERNAL_CLASS } from '../ext/external';
import { AXClass, IS_AX_CLASS } from './AXClass';
import { AXObject } from './AXObject';
import { axCoerceNumber } from './axCoerceNumber';
import { axCoerceInt } from './axCoerceInt';
import { axCoerceUint } from './axCoerceUint';
import { axCoerceBoolean } from './axCoerceBoolean';
import { axCoerceString } from './axCoerceString';

const CACHE_SIZE = 4;

// Primitive slot types coerce with the same static functions the JIT inlines;
// other types keep their class's axCoerce.
function primitiveCoercer(type: AXClass, object: AXObject): (v: any) => any {
	const sec = object.sec;
	if (type === sec.AXNumber) return axCoerceNumber;
	if (type === sec.AXInt) return axCoerceInt;
	if (type === sec.AXUint) return axCoerceUint;
	if (type === sec.AXBoolean) return axCoerceBoolean;
	if (type === sec.AXString) return axCoerceString;
	return null;
}

/**
 * A small polymorphic cache per static property name in a compiled method.
 * One entry missed whenever a write site saw objects of alternating classes
 * (serializers writing the same field name on several message classes), and
 * setter properties always took the full axSetProperty path. Slots and setters
 * are written the way axSetProperty writes them: coerce with the trait's type,
 * then assign the mangled name (a setter's JS accessor runs the AS3 setter).
 */
export function createSlotWriter(
	mn: Multiname,
	fallback: (value: any, object: AXObject) => void
): (value: any, object: AXObject) => void {
	if (mn.mutable || mn.isRuntime() || typeof mn.name !== 'string' || isNumeric(mn.name)) {
		return fallback;
	}
	const traitsCache: RuntimeTraits[] = [];
	const names: string[] = [];
	const types: AXClass[] = [];
	const coercers: Array<(v: any) => any> = [];
	let next = 0;
	return (value, object) => {
		const traits = object && object.traits;
		// Guards depend only on the object's class, which the cache keys on
		// through its traits: check them when a class enters the cache.
		const i = traits ? traitsCache.indexOf(traits) : -1;
		if (i >= 0) {
			const coerce = coercers[i], type = types[i];
			object[names[i]] = coerce ? coerce(value) : type ? type.axCoerce(value) : value;
			return;
		}
		// Native overrides (ByteArray, Vector, Proxy, XML, external classes) must
		// retain their own dispatch. AS3 cannot mutate a class's resolved traits.
		if (!traits || !object[IS_AX_CLASS] || object[IS_EXTERNAL_CLASS] ||
			object.axSetProperty !== ASObject.prototype.axSetProperty) {
			fallback(value, object);
			return;
		}
		const trait = traits.getTrait(mn.namespaces, mn.name);
		if (!trait || (trait.kind !== TRAIT.Slot && trait.kind !== TRAIT.Setter &&
			trait.kind !== TRAIT.GetterSetter)) {
			fallback(value, object);
			return;
		}
		// Resolving a type can execute AS3 initializers and re-enter this writer.
		// Finish resolution before publishing the cache entry.
		const type = trait.getType();
		const slot = next;
		next = (next + 1) % CACHE_SIZE;
		names[slot] = trait.multiname.getMangledName();
		types[slot] = type;
		const coerce = coercers[slot] = type ? primitiveCoercer(type, object) : null;
		traitsCache[slot] = traits;
		object[names[slot]] = coerce ? coerce(value) : type ? type.axCoerce(value) : value;
	};
}
