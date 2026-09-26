
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Error: Error_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[37] = list[i];
    	child_ctx[39] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[37] = list[i];
    	return child_ctx;
    }

    // (513:12) {:else}
    function create_else_block(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*scoredEntries*/ ctx[7].slice(0, 10);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*scoredEntries*/ 128) {
    				each_value_1 = /*scoredEntries*/ ctx[7].slice(0, 10);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(513:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (507:12) {#if scoredEntries.length === 0}
    function create_if_block(ctx) {
    	let li;

    	const block = {
    		c: function create() {
    			li = element("li");
    			li.textContent = "No scores yet. Be the first!";
    			attr_dev(li, "class", "svelte-h7v1mr");
    			add_location(li, file, 508, 16, 11202);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(507:12) {#if scoredEntries.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (515:16) {#each scoredEntries.slice(0, 10) as item}
    function create_each_block_1(ctx) {
    	let li;
    	let strong;
    	let t0_value = /*item*/ ctx[37].name + "";
    	let t0;
    	let t1;
    	let t2_value = /*item*/ ctx[37].score + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			li = element("li");
    			strong = element("strong");
    			t0 = text(t0_value);
    			t1 = text("\n                        — ");
    			t2 = text(t2_value);
    			t3 = text(" points\n                    ");
    			attr_dev(strong, "class", "svelte-h7v1mr");
    			add_location(strong, file, 517, 24, 11409);
    			attr_dev(li, "class", "svelte-h7v1mr");
    			add_location(li, file, 516, 20, 11380);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, strong);
    			append_dev(strong, t0);
    			append_dev(li, t1);
    			append_dev(li, t2);
    			append_dev(li, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*scoredEntries*/ 128 && t0_value !== (t0_value = /*item*/ ctx[37].name + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*scoredEntries*/ 128 && t2_value !== (t2_value = /*item*/ ctx[37].score + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(515:16) {#each scoredEntries.slice(0, 10) as item}",
    		ctx
    	});

    	return block;
    }

    // (553:20) {#each results as item, index}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*item*/ ctx[37].name + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*item*/ ctx[37].score + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = (/*item*/ ctx[37].comment || "") + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6_value = new Date(/*item*/ ctx[37].submittedAt).toLocaleString() + "";
    	let t6;
    	let t7;
    	let td4;
    	let t8_value = /*item*/ ctx[37].scoreLevel + "";
    	let t8;
    	let t9;
    	let td5;
    	let button0;
    	let t11;
    	let button1;
    	let t13;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[16](/*index*/ ctx[39], /*item*/ ctx[37]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[17](/*index*/ ctx[39]);
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td3 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			td4 = element("td");
    			t8 = text(t8_value);
    			t9 = space();
    			td5 = element("td");
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "Delete";
    			t13 = space();
    			attr_dev(td0, "class", "svelte-h7v1mr");
    			add_location(td0, file, 556, 28, 12240);
    			attr_dev(td1, "class", "svelte-h7v1mr");
    			add_location(td1, file, 558, 28, 12290);
    			attr_dev(td2, "class", "svelte-h7v1mr");
    			add_location(td2, file, 560, 28, 12341);
    			attr_dev(td3, "class", "svelte-h7v1mr");
    			add_location(td3, file, 562, 28, 12400);
    			attr_dev(td4, "class", "svelte-h7v1mr");
    			add_location(td4, file, 568, 28, 12616);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "edit-button svelte-h7v1mr");
    			add_location(button0, file, 574, 32, 12788);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "delete-button svelte-h7v1mr");
    			add_location(button1, file, 584, 32, 13205);
    			attr_dev(td5, "class", "actions svelte-h7v1mr");
    			add_location(td5, file, 572, 28, 12734);
    			attr_dev(tr, "class", "svelte-h7v1mr");
    			add_location(tr, file, 554, 24, 12206);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, t4);
    			append_dev(tr, t5);
    			append_dev(tr, td3);
    			append_dev(td3, t6);
    			append_dev(tr, t7);
    			append_dev(tr, td4);
    			append_dev(td4, t8);
    			append_dev(tr, t9);
    			append_dev(tr, td5);
    			append_dev(td5, button0);
    			append_dev(td5, t11);
    			append_dev(td5, button1);
    			append_dev(tr, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler, false, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*results*/ 1 && t0_value !== (t0_value = /*item*/ ctx[37].name + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*results*/ 1 && t2_value !== (t2_value = /*item*/ ctx[37].score + "")) set_data_dev(t2, t2_value);
    			if (dirty[0] & /*results*/ 1 && t4_value !== (t4_value = (/*item*/ ctx[37].comment || "") + "")) set_data_dev(t4, t4_value);
    			if (dirty[0] & /*results*/ 1 && t6_value !== (t6_value = new Date(/*item*/ ctx[37].submittedAt).toLocaleString() + "")) set_data_dev(t6, t6_value);
    			if (dirty[0] & /*results*/ 1 && t8_value !== (t8_value = /*item*/ ctx[37].scoreLevel + "")) set_data_dev(t8, t8_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(553:20) {#each results as item, index}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let link0;
    	let link1;
    	let t0;
    	let header;
    	let h1;
    	let t2;
    	let main;
    	let div1;
    	let canvas;
    	let t3;
    	let div0;
    	let t4;
    	let t5;
    	let p;
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let div2;
    	let h20;
    	let t11;
    	let form;
    	let label0;
    	let t13;
    	let input0;
    	let t14;
    	let label1;
    	let t16;
    	let input1;
    	let t17;
    	let label2;
    	let t19;
    	let textarea;
    	let t20;
    	let button1;
    	let t22;
    	let div3;
    	let h21;
    	let t24;
    	let ol;
    	let t25;
    	let div5;
    	let h22;
    	let t27;
    	let div4;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t29;
    	let th1;
    	let t31;
    	let th2;
    	let t33;
    	let th3;
    	let t35;
    	let th4;
    	let t37;
    	let th5;
    	let t39;
    	let tbody;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*scoredEntries*/ ctx[7].length === 0) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = /*results*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			link0 = element("link");
    			link1 = element("link");
    			t0 = space();
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "Eat the Apple";
    			t2 = space();
    			main = element("main");
    			div1 = element("div");
    			canvas = element("canvas");
    			t3 = space();
    			div0 = element("div");
    			t4 = text(/*score*/ ctx[2]);
    			t5 = space();
    			p = element("p");
    			t6 = text(/*gameStatus*/ ctx[3]);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "Reset Game";
    			t9 = space();
    			div2 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Submit Your Score";
    			t11 = space();
    			form = element("form");
    			label0 = element("label");
    			label0.textContent = "Name";
    			t13 = space();
    			input0 = element("input");
    			t14 = space();
    			label1 = element("label");
    			label1.textContent = "Score";
    			t16 = space();
    			input1 = element("input");
    			t17 = space();
    			label2 = element("label");
    			label2.textContent = "Comment";
    			t19 = space();
    			textarea = element("textarea");
    			t20 = space();
    			button1 = element("button");
    			button1.textContent = "Add Score";
    			t22 = space();
    			div3 = element("div");
    			h21 = element("h2");
    			h21.textContent = "High Scores";
    			t24 = space();
    			ol = element("ol");
    			if_block.c();
    			t25 = space();
    			div5 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Server Data";
    			t27 = space();
    			div4 = element("div");
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Name";
    			t29 = space();
    			th1 = element("th");
    			th1.textContent = "Score";
    			t31 = space();
    			th2 = element("th");
    			th2.textContent = "Comment";
    			t33 = space();
    			th3 = element("th");
    			th3.textContent = "Submitted";
    			t35 = space();
    			th4 = element("th");
    			th4.textContent = "Score Level";
    			t37 = space();
    			th5 = element("th");
    			th5.textContent = "Actions";
    			t39 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(link0, "href", "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap");
    			attr_dev(link0, "rel", "stylesheet");
    			attr_dev(link0, "class", "svelte-h7v1mr");
    			add_location(link0, file, 399, 4, 8815);
    			attr_dev(link1, "href", "https://unpkg.com/nes.css@2.3.0/css/nes.min.css");
    			attr_dev(link1, "rel", "stylesheet");
    			attr_dev(link1, "class", "svelte-h7v1mr");
    			add_location(link1, file, 404, 4, 8955);
    			attr_dev(h1, "class", "svelte-h7v1mr");
    			add_location(h1, file, 411, 4, 9085);
    			attr_dev(header, "class", "svelte-h7v1mr");
    			add_location(header, file, 410, 0, 9072);
    			attr_dev(canvas, "width", "500");
    			attr_dev(canvas, "height", "500");
    			attr_dev(canvas, "id", "game-board");
    			attr_dev(canvas, "class", "svelte-h7v1mr");
    			add_location(canvas, file, 419, 8, 9248);
    			attr_dev(div0, "id", "score-text");
    			attr_dev(div0, "class", "svelte-h7v1mr");
    			add_location(div0, file, 426, 8, 9395);
    			attr_dev(p, "id", "game-status");
    			attr_dev(p, "class", "svelte-h7v1mr");
    			add_location(p, file, 430, 8, 9461);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "nes-btn is-warning reset-button svelte-h7v1mr");
    			add_location(button0, file, 434, 8, 9529);
    			attr_dev(div1, "class", "nes-container with-title is-centered card svelte-h7v1mr");
    			attr_dev(div1, "id", "game-box");
    			add_location(div1, file, 417, 4, 9169);
    			attr_dev(h20, "class", "svelte-h7v1mr");
    			add_location(h20, file, 447, 8, 9807);
    			attr_dev(label0, "for", "game-name");
    			attr_dev(label0, "class", "svelte-h7v1mr");
    			add_location(label0, file, 451, 12, 9887);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "game-name");
    			attr_dev(input0, "maxlength", "40");
    			attr_dev(input0, "placeholder", "ex. epicgamer01");
    			input0.required = true;
    			attr_dev(input0, "class", "svelte-h7v1mr");
    			add_location(input0, file, 455, 12, 9966);
    			attr_dev(label1, "for", "score-input");
    			attr_dev(label1, "class", "svelte-h7v1mr");
    			add_location(label1, file, 464, 12, 10196);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "id", "score-input");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "step", "1");
    			input1.required = true;
    			attr_dev(input1, "class", "svelte-h7v1mr");
    			add_location(input1, file, 468, 12, 10278);
    			attr_dev(label2, "for", "score-comment");
    			attr_dev(label2, "class", "svelte-h7v1mr");
    			add_location(label2, file, 477, 12, 10490);
    			attr_dev(textarea, "id", "score-comment");
    			attr_dev(textarea, "maxlength", "300");
    			attr_dev(textarea, "placeholder", "How did you do? What game should I make next?");
    			attr_dev(textarea, "class", "svelte-h7v1mr");
    			add_location(textarea, file, 481, 12, 10576);
    			attr_dev(button1, "type", "submit");
    			attr_dev(button1, "class", "nes-btn is-warning svelte-h7v1mr");
    			add_location(button1, file, 488, 12, 10804);
    			attr_dev(form, "class", "svelte-h7v1mr");
    			add_location(form, file, 449, 8, 9843);
    			attr_dev(div2, "class", "nes-container with-title is-centered card svelte-h7v1mr");
    			add_location(div2, file, 445, 4, 9742);
    			attr_dev(h21, "class", "svelte-h7v1mr");
    			add_location(h21, file, 502, 8, 11084);
    			attr_dev(ol, "class", "leaderboard svelte-h7v1mr");
    			add_location(ol, file, 504, 8, 11114);
    			attr_dev(div3, "class", "nes-container with-title is-centered card results-card svelte-h7v1mr");
    			add_location(div3, file, 500, 4, 11006);
    			attr_dev(h22, "class", "svelte-h7v1mr");
    			add_location(h22, file, 533, 8, 11677);
    			attr_dev(th0, "class", "svelte-h7v1mr");
    			add_location(th0, file, 541, 24, 11830);
    			attr_dev(th1, "class", "svelte-h7v1mr");
    			add_location(th1, file, 542, 24, 11868);
    			attr_dev(th2, "class", "svelte-h7v1mr");
    			add_location(th2, file, 543, 24, 11907);
    			attr_dev(th3, "class", "svelte-h7v1mr");
    			add_location(th3, file, 544, 24, 11948);
    			attr_dev(th4, "class", "svelte-h7v1mr");
    			add_location(th4, file, 545, 24, 11991);
    			attr_dev(th5, "class", "svelte-h7v1mr");
    			add_location(th5, file, 546, 24, 12036);
    			attr_dev(tr, "class", "svelte-h7v1mr");
    			add_location(tr, file, 540, 20, 11801);
    			attr_dev(thead, "class", "svelte-h7v1mr");
    			add_location(thead, file, 539, 16, 11773);
    			attr_dev(tbody, "class", "svelte-h7v1mr");
    			add_location(tbody, file, 550, 16, 12121);
    			attr_dev(table, "class", "svelte-h7v1mr");
    			add_location(table, file, 537, 12, 11748);
    			attr_dev(div4, "class", "table-wrapper svelte-h7v1mr");
    			add_location(div4, file, 535, 8, 11707);
    			attr_dev(div5, "class", "nes-container with-title is-centered card svelte-h7v1mr");
    			add_location(div5, file, 531, 4, 11612);
    			attr_dev(main, "class", "page-layout svelte-h7v1mr");
    			add_location(main, file, 414, 0, 9119);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, link0);
    			append_dev(document.head, link1);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, canvas);
    			/*canvas_binding*/ ctx[12](canvas);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			append_dev(div1, p);
    			append_dev(p, t6);
    			append_dev(div1, t7);
    			append_dev(div1, button0);
    			append_dev(main, t9);
    			append_dev(main, div2);
    			append_dev(div2, h20);
    			append_dev(div2, t11);
    			append_dev(div2, form);
    			append_dev(form, label0);
    			append_dev(form, t13);
    			append_dev(form, input0);
    			set_input_value(input0, /*name*/ ctx[4]);
    			append_dev(form, t14);
    			append_dev(form, label1);
    			append_dev(form, t16);
    			append_dev(form, input1);
    			set_input_value(input1, /*scoreInput*/ ctx[5]);
    			append_dev(form, t17);
    			append_dev(form, label2);
    			append_dev(form, t19);
    			append_dev(form, textarea);
    			set_input_value(textarea, /*comment*/ ctx[6]);
    			append_dev(form, t20);
    			append_dev(form, button1);
    			append_dev(main, t22);
    			append_dev(main, div3);
    			append_dev(div3, h21);
    			append_dev(div3, t24);
    			append_dev(div3, ol);
    			if_block.m(ol, null);
    			append_dev(main, t25);
    			append_dev(main, div5);
    			append_dev(div5, h22);
    			append_dev(div5, t27);
    			append_dev(div5, div4);
    			append_dev(div4, table);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t29);
    			append_dev(tr, th1);
    			append_dev(tr, t31);
    			append_dev(tr, th2);
    			append_dev(tr, t33);
    			append_dev(tr, th3);
    			append_dev(tr, t35);
    			append_dev(tr, th4);
    			append_dev(tr, t37);
    			append_dev(tr, th5);
    			append_dev(table, t39);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(tbody, null);
    				}
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*resetGame*/ ctx[11], false, false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[13]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[14]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[15]),
    					listen_dev(form, "submit", /*submitScore*/ ctx[8], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*score*/ 4) set_data_dev(t4, /*score*/ ctx[2]);
    			if (dirty[0] & /*gameStatus*/ 8) set_data_dev(t6, /*gameStatus*/ ctx[3]);

    			if (dirty[0] & /*name*/ 16 && input0.value !== /*name*/ ctx[4]) {
    				set_input_value(input0, /*name*/ ctx[4]);
    			}

    			if (dirty[0] & /*scoreInput*/ 32 && to_number(input1.value) !== /*scoreInput*/ ctx[5]) {
    				set_input_value(input1, /*scoreInput*/ ctx[5]);
    			}

    			if (dirty[0] & /*comment*/ 64) {
    				set_input_value(textarea, /*comment*/ ctx[6]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(ol, null);
    				}
    			}

    			if (dirty[0] & /*deleteEntry, editEntry, results*/ 1537) {
    				each_value = /*results*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			detach_dev(link0);
    			detach_dev(link1);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(main);
    			/*canvas_binding*/ ctx[12](null);
    			if_block.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const gameWidth = 500;
    const gameHeight = 500;
    const boardBackground = "lightgreen";
    const snakeColor = "purple";
    const foodColor = "red";
    const unitSize = 25;

    function instance($$self, $$props, $$invalidate) {
    	let scoredEntries;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let gameBoard;
    	let ctx;

    	// Game state
    	let running = false;

    	let xVelocity = unitSize;
    	let yVelocity = 0;
    	let foodX;
    	let foodY;
    	let score = 0;
    	let snake = [{ x: unitSize, y: 0 }, { x: 0, y: 0 }];
    	let gameStatus = "Use the arrow keys to move.";

    	// -----------------------------
    	// Server / leaderboard state
    	// -----------------------------
    	let results = [];

    	let name = "";
    	let scoreInput = 0;
    	let comment = "";

    	// -----------------------------
    	// Start application
    	// -----------------------------
    	onMount(() => {
    		ctx = gameBoard.getContext("2d");
    		loadData();
    		gameStart();
    		window.addEventListener("keydown", changeDirection);

    		return () => {
    			window.removeEventListener("keydown", changeDirection);
    			running = false;
    		};
    	});

    	// -----------------------------
    	// API functions
    	// -----------------------------
    	async function loadData() {
    		try {
    			const response = await fetch("/api/data");
    			const data = await response.json();
    			$$invalidate(0, results = data);
    		} catch(error) {
    			console.error("Could not load data:", error);
    		}
    	}

    	async function sendEntry(entry) {
    		const response = await fetch("/api/data", {
    			method: "POST",
    			headers: { "Content-Type": "application/json" },
    			body: JSON.stringify(entry)
    		});

    		const data = await response.json();

    		if (!response.ok) {
    			throw new Error(data.error || "Could not save entry.");
    		}

    		$$invalidate(0, results = data);
    	}

    	async function submitScore(event) {
    		event.preventDefault();

    		try {
    			await sendEntry({ name, score: Number(scoreInput), comment });

    			// Reset the form
    			$$invalidate(4, name = "");

    			$$invalidate(6, comment = "");
    			$$invalidate(5, scoreInput = score);
    			alert("Your score was added to the leaderboard!");
    		} catch(error) {
    			alert(error.message);
    		}
    	}

    	async function deleteEntry(index) {
    		if (!confirm("Delete this entry?")) {
    			return;
    		}

    		try {
    			const response = await fetch("/api/data", {
    				method: "DELETE",
    				headers: { "Content-Type": "application/json" },
    				body: JSON.stringify({ index })
    			});

    			const data = await response.json();

    			if (!response.ok) {
    				alert(data.error || "Could not delete entry.");
    				return;
    			}

    			$$invalidate(0, results = data);
    		} catch(error) {
    			alert(error.message);
    		}
    	}

    	async function editEntry(index, item) {
    		const newName = prompt("Name:", item.name);

    		if (newName === null) {
    			return;
    		}

    		const scoreValue = prompt("Score:", item.score);

    		if (scoreValue === null) {
    			return;
    		}

    		const newComment = prompt("Comment:", item.comment || "");

    		if (newComment === null) {
    			return;
    		}

    		try {
    			const response = await fetch("/api/data", {
    				method: "PUT",
    				headers: { "Content-Type": "application/json" },
    				body: JSON.stringify({
    					index,
    					name: newName,
    					score: Number(scoreValue),
    					comment: newComment,
    					submittedAt: item.submittedAt
    				})
    			});

    			const data = await response.json();

    			if (!response.ok) {
    				alert(data.error || "Could not update entry.");
    				return;
    			}

    			$$invalidate(0, results = data);
    		} catch(error) {
    			alert(error.message);
    		}
    	}

    	// -----------------------------
    	// Snake game
    	// -----------------------------
    	function gameStart() {
    		running = true;
    		$$invalidate(2, score = 0);
    		$$invalidate(3, gameStatus = "Use the arrow keys to move.");
    		createFood();
    		clearBoard();
    		drawFood();
    		drawSnake();
    		nextTick();
    	}

    	function nextTick() {
    		if (!running) {
    			displayGameOver();
    			return;
    		}

    		setTimeout(
    			() => {
    				clearBoard();
    				drawFood();
    				moveSnake();
    				drawSnake();
    				checkGameOver();
    				nextTick();
    			},
    			75
    		);
    	}

    	function clearBoard() {
    		if (!ctx) return;
    		ctx.fillStyle = boardBackground;
    		ctx.fillRect(0, 0, gameWidth, gameHeight);
    	}

    	function createFood() {
    		function randomFood(min, max) {
    			return Math.floor((Math.random() * (max - min) + min) / unitSize) * unitSize;
    		}

    		foodX = randomFood(0, gameWidth - unitSize);
    		foodY = randomFood(0, gameHeight - unitSize);
    	}

    	function drawFood() {
    		if (!ctx) return;
    		ctx.fillStyle = foodColor;
    		ctx.fillRect(foodX, foodY, unitSize, unitSize);
    	}

    	function moveSnake() {
    		const head = {
    			x: snake[0].x + xVelocity,
    			y: snake[0].y + yVelocity
    		};

    		snake = [head, ...snake];

    		if (snake[0].x === foodX && snake[0].y === foodY) {
    			$$invalidate(2, score += 1);
    			createFood();
    		} else {
    			snake.pop();
    		}
    	}

    	function drawSnake() {
    		if (!ctx) return;
    		ctx.fillStyle = snakeColor;

    		snake.forEach(snakePart => {
    			ctx.fillRect(snakePart.x, snakePart.y, unitSize, unitSize);
    		});
    	}

    	function changeDirection(event) {
    		const keyPressed = event.key;
    		const goingUp = yVelocity === -unitSize;
    		const goingDown = yVelocity === unitSize;
    		const goingRight = xVelocity === unitSize;
    		const goingLeft = xVelocity === -unitSize;

    		if (keyPressed === "ArrowLeft" && !goingRight) {
    			xVelocity = -unitSize;
    			yVelocity = 0;
    		} else if (keyPressed === "ArrowUp" && !goingDown) {
    			xVelocity = 0;
    			yVelocity = -unitSize;
    		} else if (keyPressed === "ArrowRight" && !goingLeft) {
    			xVelocity = unitSize;
    			yVelocity = 0;
    		} else if (keyPressed === "ArrowDown" && !goingUp) {
    			xVelocity = 0;
    			yVelocity = unitSize;
    		}
    	}

    	function checkGameOver() {
    		// Hit wall
    		if (snake[0].x < 0 || snake[0].x >= gameWidth || snake[0].y < 0 || snake[0].y >= gameHeight) {
    			running = false;
    			return;
    		}

    		// Hit itself
    		for (let i = 1; i < snake.length; i += 1) {
    			if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {
    				running = false;
    				return;
    			}
    		}
    	}

    	function displayGameOver() {
    		if (!ctx) return;
    		ctx.font = "75px 'Caudex', serif";
    		ctx.fillStyle = "black";
    		ctx.textAlign = "center";
    		ctx.fillText("GAME OVER", gameWidth / 2, gameHeight / 2);
    		$$invalidate(3, gameStatus = "Game over! Press Reset Game to play again.");
    		running = false;
    	}

    	function resetGame() {
    		xVelocity = unitSize;
    		yVelocity = 0;
    		snake = [{ x: unitSize, y: 0 }, { x: 0, y: 0 }];
    		gameStart();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function canvas_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			gameBoard = $$value;
    			$$invalidate(1, gameBoard);
    		});
    	}

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(4, name);
    	}

    	function input1_input_handler() {
    		scoreInput = to_number(this.value);
    		$$invalidate(5, scoreInput);
    	}

    	function textarea_input_handler() {
    		comment = this.value;
    		$$invalidate(6, comment);
    	}

    	const click_handler = (index, item) => editEntry(index, item);
    	const click_handler_1 = index => deleteEntry(index);

    	$$self.$capture_state = () => ({
    		onMount,
    		gameWidth,
    		gameHeight,
    		boardBackground,
    		snakeColor,
    		foodColor,
    		unitSize,
    		gameBoard,
    		ctx,
    		running,
    		xVelocity,
    		yVelocity,
    		foodX,
    		foodY,
    		score,
    		snake,
    		gameStatus,
    		results,
    		name,
    		scoreInput,
    		comment,
    		loadData,
    		sendEntry,
    		submitScore,
    		deleteEntry,
    		editEntry,
    		gameStart,
    		nextTick,
    		clearBoard,
    		createFood,
    		drawFood,
    		moveSnake,
    		drawSnake,
    		changeDirection,
    		checkGameOver,
    		displayGameOver,
    		resetGame,
    		scoredEntries
    	});

    	$$self.$inject_state = $$props => {
    		if ('gameBoard' in $$props) $$invalidate(1, gameBoard = $$props.gameBoard);
    		if ('ctx' in $$props) ctx = $$props.ctx;
    		if ('running' in $$props) running = $$props.running;
    		if ('xVelocity' in $$props) xVelocity = $$props.xVelocity;
    		if ('yVelocity' in $$props) yVelocity = $$props.yVelocity;
    		if ('foodX' in $$props) foodX = $$props.foodX;
    		if ('foodY' in $$props) foodY = $$props.foodY;
    		if ('score' in $$props) $$invalidate(2, score = $$props.score);
    		if ('snake' in $$props) snake = $$props.snake;
    		if ('gameStatus' in $$props) $$invalidate(3, gameStatus = $$props.gameStatus);
    		if ('results' in $$props) $$invalidate(0, results = $$props.results);
    		if ('name' in $$props) $$invalidate(4, name = $$props.name);
    		if ('scoreInput' in $$props) $$invalidate(5, scoreInput = $$props.scoreInput);
    		if ('comment' in $$props) $$invalidate(6, comment = $$props.comment);
    		if ('scoredEntries' in $$props) $$invalidate(7, scoredEntries = $$props.scoredEntries);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*results*/ 1) {
    			$$invalidate(7, scoredEntries = results.filter(item => Number(item.score) > 0).sort((a, b) => Number(b.score) - Number(a.score)));
    		}
    	};

    	return [
    		results,
    		gameBoard,
    		score,
    		gameStatus,
    		name,
    		scoreInput,
    		comment,
    		scoredEntries,
    		submitScore,
    		deleteEntry,
    		editEntry,
    		resetGame,
    		canvas_binding,
    		input0_input_handler,
    		input1_input_handler,
    		textarea_input_handler,
    		click_handler,
    		click_handler_1
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
