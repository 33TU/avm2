import { isNumeric } from '@awayfl/swf-loader';
import { Multiname } from '../abc/lazy/Multiname';
import { RuntimeTraits } from '../abc/lazy/RuntimeTraits';
import { TRAIT } from '../abc/lazy/TRAIT';
import { ASObject } from '../nat/ASObject';
import { IS_EXTERNAL_CLASS } from '../ext/external';
import { AXClass, IS_AX_CLASS } from './AXClass';
import { AXObject } from './AXObject';

/** One monomorphic cache per static property name in a compiled method. */
export function createSlotWriter(
	mn: Multiname,
	fallback: (value: any, object: AXObject) => void
): (value: any, object: AXObject) => void {
	if (mn.mutable || mn.isRuntime() || typeof mn.name !== 'string' || isNumeric(mn.name)) {
		return fallback;
	}
	let cachedTraits: RuntimeTraits;
	let mangledName: string;
	let type: AXClass;
	return (value, object) => {
		// Native overrides (ByteArray, Vector, Proxy, XML, external classes) must
		// retain their own dispatch. AS3 cannot mutate a class's resolved traits.
		if (!object || !object[IS_AX_CLASS] || object[IS_EXTERNAL_CLASS] ||
			object.axSetProperty !== ASObject.prototype.axSetProperty) {
			fallback(value, object);
			return;
		}
		const traits = object.traits;
		if (!traits) {
			fallback(value, object);
			return;
		}
		if (traits !== cachedTraits) {
			const trait = traits.getTrait(mn.namespaces, mn.name);
			if (!trait || trait.kind !== TRAIT.Slot) {
				fallback(value, object);
				return;
			}
			// Resolving a type can execute AS3 initializers and re-enter this writer.
			// Finish resolution before publishing the cache entry.
			const resolvedType = trait.getType();
			mangledName = trait.multiname.getMangledName();
			type = resolvedType;
			cachedTraits = traits;
		}
		object[mangledName] = type ? type.axCoerce(value) : value;
	};
}
