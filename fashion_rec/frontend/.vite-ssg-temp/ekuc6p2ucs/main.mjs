import { useSSRContext, resolveComponent, withCtx, createVNode, resolveDynamicComponent, createBlock, openBlock, KeepAlive, toValue, isRef, defineComponent, ref, onMounted, createSSRApp, unref, mergeProps, renderSlot, computed, createTextVNode, toDisplayString, Fragment, renderList, onActivated, onUnmounted, watch } from "vue";
import { ssrRenderComponent, ssrRenderVNode, ssrRenderSlot, ssrRenderClass, ssrRenderAttrs, ssrInterpolate, ssrRenderAttr, ssrRenderList, ssrRenderStyle, ssrIncludeBooleanAttr, ssrLooseContain } from "vue/server-renderer";
import { createRouter, createMemoryHistory, useRouter, useRoute, createWebHistory } from "vue-router";
import { useHead, createHead as createHead$2 } from "@vueuse/head";
import { defineStore, createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { cva } from "class-variance-authority";
import { Primitive, useForwardPropsEmits, AccordionRoot, AccordionContent, useForwardProps, AccordionItem, AccordionHeader, AccordionTrigger } from "reka-ui";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { reactiveOmit } from "@vueuse/core";
import { ChevronDown, X, Upload, Clock, Trash2, Wand2, Search, Shirt, Heart, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, ShoppingBag, Download, Loader2, ExternalLink, RotateCcw, History, ArrowLeft, User } from "lucide-vue-next";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
const _sfc_main$k = {
  __name: "App",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_view = resolveComponent("router-view");
      _push(ssrRenderComponent(_component_router_view, _attrs, {
        default: withCtx(({ Component }, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(``);
            ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(Component), null, null), _parent2, _scopeId);
          } else {
            return [
              (openBlock(), createBlock(KeepAlive, null, [
                (openBlock(), createBlock(resolveDynamicComponent(Component)))
              ], 1024))
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
};
const _sfc_setup$k = _sfc_main$k.setup;
_sfc_main$k.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/App.vue");
  return _sfc_setup$k ? _sfc_setup$k(props, ctx) : void 0;
};
function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === "object" && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === "function") {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
const defaultTask = { run: (function_) => function_() };
const _createTask = () => defaultTask;
const createTask = typeof console.createTask !== "undefined" ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return hooks.reduce(
    (promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))),
    Promise.resolve()
  );
}
function parallelTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
  for (const callback of [...callbacks]) {
    callback(arg0);
  }
}
class Hookable {
  constructor() {
    this._hooks = {};
    this._before = void 0;
    this._after = void 0;
    this._deprecatedMessages = void 0;
    this._deprecatedHooks = {};
    this.hook = this.hook.bind(this);
    this.callHook = this.callHook.bind(this);
    this.callHookWith = this.callHookWith.bind(this);
  }
  hook(name, function_, options = {}) {
    if (!name || typeof function_ !== "function") {
      return () => {
      };
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    if (!function_.name) {
      try {
        Object.defineProperty(function_, "name", {
          get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
          configurable: true
        });
      } catch {
      }
    }
    this._hooks[name] = this._hooks[name] || [];
    this._hooks[name].push(function_);
    return () => {
      if (function_) {
        this.removeHook(name, function_);
        function_ = void 0;
      }
    };
  }
  hookOnce(name, function_) {
    let _unreg;
    let _function = (...arguments_) => {
      if (typeof _unreg === "function") {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    delete this._hooks[name];
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map(
      (key) => this.hook(key, hooks[key])
    );
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  removeAllHooks() {
    for (const key in this._hooks) {
      delete this._hooks[key];
    }
  }
  callHook(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(serialTaskCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(parallelTaskCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(
      name in this._hooks ? [...this._hooks[name]] : [],
      arguments_
    );
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      if (this._before !== void 0) {
        const index = this._before.indexOf(function_);
        if (index !== -1) {
          this._before.splice(index, 1);
        }
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      if (this._after !== void 0) {
        const index = this._after.indexOf(function_);
        if (index !== -1) {
          this._after.splice(index, 1);
        }
      }
    };
  }
}
function createHooks() {
  return new Hookable();
}
const DupeableTags = /* @__PURE__ */ new Set(["link", "style", "script", "noscript"]);
const TagsWithInnerContent = /* @__PURE__ */ new Set(["title", "titleTemplate", "script", "style", "noscript"]);
const ValidHeadTags = /* @__PURE__ */ new Set([
  "title",
  "base",
  "htmlAttrs",
  "bodyAttrs",
  "meta",
  "link",
  "style",
  "script",
  "noscript"
]);
const UniqueTags = /* @__PURE__ */ new Set(["base", "title", "titleTemplate", "bodyAttrs", "htmlAttrs", "templateParams"]);
const TagConfigKeys = /* @__PURE__ */ new Set(["key", "tagPosition", "tagPriority", "tagDuplicateStrategy", "innerHTML", "textContent", "processTemplateParams"]);
const UsesMergeStrategy = /* @__PURE__ */ new Set(["templateParams", "htmlAttrs", "bodyAttrs"]);
const MetaTagsArrayable = /* @__PURE__ */ new Set([
  "theme-color",
  "google-site-verification",
  "og",
  "article",
  "book",
  "profile",
  "twitter",
  "author"
]);
const allowedMetaProperties = ["name", "property", "http-equiv"];
const StandardSingleMetaTags = /* @__PURE__ */ new Set([
  "viewport",
  "description",
  "keywords",
  "robots"
]);
function isMetaArrayDupeKey(v) {
  const parts = v.split(":");
  if (!parts.length)
    return false;
  return MetaTagsArrayable.has(parts[1]);
}
function dedupeKey(tag) {
  const { props, tag: name } = tag;
  if (UniqueTags.has(name))
    return name;
  if (name === "link" && props.rel === "canonical")
    return "canonical";
  if (props.charset)
    return "charset";
  if (tag.tag === "meta") {
    for (const n of allowedMetaProperties) {
      if (props[n] !== void 0) {
        const propValue = props[n];
        const isStructured = propValue.includes(":");
        const isStandardSingle = StandardSingleMetaTags.has(propValue);
        const shouldAlwaysDedupe = isStructured || isStandardSingle;
        const keyPart = !shouldAlwaysDedupe && tag.key ? `:key:${tag.key}` : "";
        return `${name}:${propValue}${keyPart}`;
      }
    }
  }
  if (tag.key) {
    return `${name}:key:${tag.key}`;
  }
  if (props.id) {
    return `${name}:id:${props.id}`;
  }
  if (TagsWithInnerContent.has(name)) {
    const v = tag.textContent || tag.innerHTML;
    if (v) {
      return `${name}:content:${v}`;
    }
  }
}
function walkResolver(val, resolve, key) {
  const type = typeof val;
  if (type === "function") {
    if (!key || key !== "titleTemplate" && !(key[0] === "o" && key[1] === "n")) {
      val = val();
    }
  }
  let v;
  if (resolve) {
    v = resolve(key, val);
  }
  if (Array.isArray(v)) {
    return v.map((r) => walkResolver(r, resolve));
  }
  if ((v == null ? void 0 : v.constructor) === Object) {
    const next = {};
    for (const key2 of Object.keys(v)) {
      next[key2] = walkResolver(v[key2], resolve, key2);
    }
    return next;
  }
  return v;
}
function normalizeStyleClassProps(key, value) {
  const store = key === "style" ? /* @__PURE__ */ new Map() : /* @__PURE__ */ new Set();
  function processValue(rawValue) {
    const value2 = rawValue.trim();
    if (!value2)
      return;
    if (key === "style") {
      const [k, ...v] = value2.split(":").map((s) => s.trim());
      if (k && v.length)
        store.set(k, v.join(":"));
    } else {
      value2.split(" ").filter(Boolean).forEach((c) => store.add(c));
    }
  }
  if (typeof value === "string") {
    key === "style" ? value.split(";").forEach(processValue) : processValue(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => processValue(item));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      if (v && v !== "false") {
        key === "style" ? store.set(k.trim(), v) : processValue(k);
      }
    });
  }
  return store;
}
function normalizeProps(tag, input) {
  tag.props = tag.props || {};
  if (!input) {
    return tag;
  }
  if (tag.tag === "templateParams") {
    tag.props = input;
    return tag;
  }
  Object.entries(input).forEach(([key, value]) => {
    if (value === null) {
      tag.props[key] = null;
      return;
    }
    if (key === "class" || key === "style") {
      tag.props[key] = normalizeStyleClassProps(key, value);
      return;
    }
    if (TagConfigKeys.has(key)) {
      if (["textContent", "innerHTML"].includes(key) && typeof value === "object") {
        let type = input.type;
        if (!input.type) {
          type = "application/json";
        }
        if (!(type == null ? void 0 : type.endsWith("json")) && type !== "speculationrules") {
          return;
        }
        input.type = type;
        tag.props.type = type;
        tag[key] = JSON.stringify(value);
      } else {
        tag[key] = value;
      }
      return;
    }
    const strValue = String(value);
    const isDataKey = key.startsWith("data-");
    if (strValue === "true" || strValue === "") {
      tag.props[key] = isDataKey ? strValue : true;
    } else if (!value && isDataKey && strValue === "false") {
      tag.props[key] = "false";
    } else if (value !== void 0) {
      tag.props[key] = value;
    }
  });
  return tag;
}
function normalizeTag(tagName, _input) {
  const input = typeof _input === "object" && typeof _input !== "function" ? _input : { [tagName === "script" || tagName === "noscript" || tagName === "style" ? "innerHTML" : "textContent"]: _input };
  const tag = normalizeProps({ tag: tagName, props: {} }, input);
  if (tag.key && DupeableTags.has(tag.tag)) {
    tag.props["data-hid"] = tag._h = tag.key;
  }
  if (tag.tag === "script" && typeof tag.innerHTML === "object") {
    tag.innerHTML = JSON.stringify(tag.innerHTML);
    tag.props.type = tag.props.type || "application/json";
  }
  return Array.isArray(tag.props.content) ? tag.props.content.map((v) => ({ ...tag, props: { ...tag.props, content: v } })) : tag;
}
function normalizeEntryToTags(input, propResolvers) {
  if (!input) {
    return [];
  }
  if (typeof input === "function") {
    input = input();
  }
  const resolvers = (key, val) => {
    for (let i = 0; i < propResolvers.length; i++) {
      val = propResolvers[i](key, val);
    }
    return val;
  };
  input = resolvers(void 0, input);
  const tags = [];
  input = walkResolver(input, resolvers);
  Object.entries(input || {}).forEach(([key, value]) => {
    if (value === void 0)
      return;
    for (const v of Array.isArray(value) ? value : [value])
      tags.push(normalizeTag(key, v));
  });
  return tags.flat();
}
const sortTags = (a, b) => a._w === b._w ? a._p - b._p : a._w - b._w;
const TAG_WEIGHTS = {
  base: -10,
  title: 10
};
const TAG_ALIASES = {
  critical: -8,
  high: -1,
  low: 2
};
const WEIGHT_MAP = {
  meta: {
    "content-security-policy": -30,
    "charset": -20,
    "viewport": -15
  },
  link: {
    "preconnect": 20,
    "stylesheet": 60,
    "preload": 70,
    "modulepreload": 70,
    "prefetch": 90,
    "dns-prefetch": 90,
    "prerender": 90
  },
  script: {
    async: 30,
    defer: 80,
    sync: 50
  },
  style: {
    imported: 40,
    sync: 60
  }
};
const ImportStyleRe = /@import/;
const isTruthy = (val) => val === "" || val === true;
function tagWeight(head, tag) {
  var _a;
  if (typeof tag.tagPriority === "number")
    return tag.tagPriority;
  let weight = 100;
  const offset = TAG_ALIASES[tag.tagPriority] || 0;
  const weightMap = head.resolvedOptions.disableCapoSorting ? {
    link: {},
    script: {},
    style: {}
  } : WEIGHT_MAP;
  if (tag.tag in TAG_WEIGHTS) {
    weight = TAG_WEIGHTS[tag.tag];
  } else if (tag.tag === "meta") {
    const metaType = tag.props["http-equiv"] === "content-security-policy" ? "content-security-policy" : tag.props.charset ? "charset" : tag.props.name === "viewport" ? "viewport" : null;
    if (metaType)
      weight = WEIGHT_MAP.meta[metaType];
  } else if (tag.tag === "link" && tag.props.rel) {
    weight = weightMap.link[tag.props.rel];
  } else if (tag.tag === "script") {
    if (isTruthy(tag.props.async)) {
      weight = weightMap.script.async;
    } else if (tag.props.src && !isTruthy(tag.props.defer) && !isTruthy(tag.props.async) && tag.props.type !== "module" && !((_a = tag.props.type) == null ? void 0 : _a.endsWith("json"))) {
      weight = weightMap.script.sync;
    } else if (isTruthy(tag.props.defer) && tag.props.src && !isTruthy(tag.props.async)) {
      weight = weightMap.script.defer;
    }
  } else if (tag.tag === "style") {
    weight = tag.innerHTML && ImportStyleRe.test(tag.innerHTML) ? weightMap.style.imported : weightMap.style.sync;
  }
  return (weight || 100) + offset;
}
function registerPlugin(head, p) {
  const plugin = typeof p === "function" ? p(head) : p;
  const key = plugin.key || String(head.plugins.size + 1);
  const exists = head.plugins.get(key);
  if (!exists) {
    head.plugins.set(key, plugin);
    head.hooks.addHooks(plugin.hooks || {});
  }
}
// @__NO_SIDE_EFFECTS__
function createUnhead(resolvedOptions = {}) {
  var _a;
  const hooks = createHooks();
  hooks.addHooks(resolvedOptions.hooks || {});
  const ssr = !resolvedOptions.document;
  const entries = /* @__PURE__ */ new Map();
  const plugins = /* @__PURE__ */ new Map();
  const normalizeQueue = /* @__PURE__ */ new Set();
  const head = {
    _entryCount: 1,
    // 0 is reserved for internal use
    plugins,
    dirty: false,
    resolvedOptions,
    hooks,
    ssr,
    entries,
    headEntries() {
      return [...entries.values()];
    },
    use: (p) => registerPlugin(head, p),
    push(input, _options) {
      const options = { ..._options || {} };
      delete options.head;
      const _i = options._index ?? head._entryCount++;
      const inst = { _i, input, options };
      const _ = {
        _poll(rm = false) {
          head.dirty = true;
          !rm && normalizeQueue.add(_i);
          hooks.callHook("entries:updated", head);
        },
        dispose() {
          if (entries.delete(_i)) {
            head.invalidate();
          }
        },
        // a patch is the same as creating a new entry, just a nice DX
        patch(input2) {
          if (!options.mode || options.mode === "server" && ssr || options.mode === "client" && !ssr) {
            inst.input = input2;
            entries.set(_i, inst);
            _._poll();
          }
        }
      };
      _.patch(input);
      return _;
    },
    async resolveTags() {
      var _a2;
      const ctx = {
        tagMap: /* @__PURE__ */ new Map(),
        tags: [],
        entries: [...head.entries.values()]
      };
      await hooks.callHook("entries:resolve", ctx);
      while (normalizeQueue.size) {
        const i = normalizeQueue.values().next().value;
        normalizeQueue.delete(i);
        const e = entries.get(i);
        if (e) {
          const normalizeCtx = {
            tags: normalizeEntryToTags(e.input, resolvedOptions.propResolvers || []).map((t) => Object.assign(t, e.options)),
            entry: e
          };
          await hooks.callHook("entries:normalize", normalizeCtx);
          e._tags = normalizeCtx.tags.map((t, i2) => {
            t._w = tagWeight(head, t);
            t._p = (e._i << 10) + i2;
            t._d = dedupeKey(t);
            return t;
          });
        }
      }
      let hasFlatMeta = false;
      ctx.entries.flatMap((e) => (e._tags || []).map((t) => ({ ...t, props: { ...t.props } }))).sort(sortTags).reduce((acc, next) => {
        const k = String(next._d || next._p);
        if (!acc.has(k))
          return acc.set(k, next);
        const prev = acc.get(k);
        const strategy = (next == null ? void 0 : next.tagDuplicateStrategy) || (UsesMergeStrategy.has(next.tag) ? "merge" : null) || (next.key && next.key === prev.key ? "merge" : null);
        if (strategy === "merge") {
          const newProps = { ...prev.props };
          Object.entries(next.props).forEach(([p, v]) => (
            // @ts-expect-error untyped
            newProps[p] = p === "style" ? new Map([...prev.props.style || /* @__PURE__ */ new Map(), ...v]) : p === "class" ? /* @__PURE__ */ new Set([...prev.props.class || /* @__PURE__ */ new Set(), ...v]) : v
          ));
          acc.set(k, { ...next, props: newProps });
        } else if (next._p >> 10 === prev._p >> 10 && next.tag === "meta" && isMetaArrayDupeKey(k)) {
          acc.set(k, Object.assign([...Array.isArray(prev) ? prev : [prev], next], next));
          hasFlatMeta = true;
        } else if (next._w === prev._w ? next._p > prev._p : (next == null ? void 0 : next._w) < (prev == null ? void 0 : prev._w)) {
          acc.set(k, next);
        }
        return acc;
      }, ctx.tagMap);
      const title = ctx.tagMap.get("title");
      const titleTemplate = ctx.tagMap.get("titleTemplate");
      head._title = title == null ? void 0 : title.textContent;
      if (titleTemplate) {
        const titleTemplateFn = titleTemplate == null ? void 0 : titleTemplate.textContent;
        head._titleTemplate = titleTemplateFn;
        if (titleTemplateFn) {
          let newTitle = typeof titleTemplateFn === "function" ? titleTemplateFn(title == null ? void 0 : title.textContent) : titleTemplateFn;
          if (typeof newTitle === "string" && !head.plugins.has("template-params")) {
            newTitle = newTitle.replace("%s", (title == null ? void 0 : title.textContent) || "");
          }
          if (title) {
            newTitle === null ? ctx.tagMap.delete("title") : ctx.tagMap.set("title", { ...title, textContent: newTitle });
          } else {
            titleTemplate.tag = "title";
            titleTemplate.textContent = newTitle;
          }
        }
      }
      ctx.tags = Array.from(ctx.tagMap.values());
      if (hasFlatMeta) {
        ctx.tags = ctx.tags.flat().sort(sortTags);
      }
      await hooks.callHook("tags:beforeResolve", ctx);
      await hooks.callHook("tags:resolve", ctx);
      await hooks.callHook("tags:afterResolve", ctx);
      const finalTags = [];
      for (const t of ctx.tags) {
        const { innerHTML, tag, props } = t;
        if (!ValidHeadTags.has(tag)) {
          continue;
        }
        if (Object.keys(props).length === 0 && !t.innerHTML && !t.textContent) {
          continue;
        }
        if (tag === "meta" && !props.content && !props["http-equiv"] && !props.charset) {
          continue;
        }
        if (tag === "script" && innerHTML) {
          if ((_a2 = props.type) == null ? void 0 : _a2.endsWith("json")) {
            const v = typeof innerHTML === "string" ? innerHTML : JSON.stringify(innerHTML);
            t.innerHTML = v.replace(/</g, "\\u003C");
          } else if (typeof innerHTML === "string") {
            t.innerHTML = innerHTML.replace(new RegExp(`</${tag}`, "g"), `<\\/${tag}`);
          }
          t._d = dedupeKey(t);
        }
        finalTags.push(t);
      }
      return finalTags;
    },
    invalidate() {
      for (const entry of entries.values()) {
        normalizeQueue.add(entry._i);
      }
      head.dirty = true;
      hooks.callHook("entries:updated", head);
    }
  };
  ((resolvedOptions == null ? void 0 : resolvedOptions.plugins) || []).forEach((p) => registerPlugin(head, p));
  head.hooks.callHook("init", head);
  (_a = resolvedOptions.init) == null ? void 0 : _a.forEach((e) => e && head.push(e));
  return head;
}
const VueResolver = (_, value) => {
  return isRef(value) ? toValue(value) : value;
};
const headSymbol = "usehead";
// @__NO_SIDE_EFFECTS__
function vueInstall(head) {
  const plugin = {
    install(app) {
      app.config.globalProperties.$unhead = head;
      app.config.globalProperties.$head = head;
      app.provide(headSymbol, head);
    }
  };
  return plugin.install;
}
// @__NO_SIDE_EFFECTS__
function createHead$1(options = {}) {
  const unhead = /* @__PURE__ */ createUnhead({
    ...options,
    // @ts-expect-error untyped
    document: false,
    propResolvers: [
      ...options.propResolvers || [],
      (k, v) => {
        if (k && k.startsWith("on") && typeof v === "function") {
          return `this.dataset.${k}fired = true`;
        }
        return v;
      }
    ],
    init: [
      options.disableDefaults ? void 0 : {
        htmlAttrs: {
          lang: "en"
        },
        meta: [
          {
            charset: "utf-8"
          },
          {
            name: "viewport",
            content: "width=device-width, initial-scale=1"
          }
        ]
      },
      ...options.init || []
    ]
  });
  unhead._ssrPayload = {};
  unhead.use({
    key: "server",
    hooks: {
      "tags:resolve": function(ctx) {
        const title = ctx.tagMap.get("title");
        const titleTemplate = ctx.tagMap.get("titleTemplate");
        let payload = {
          title: (title == null ? void 0 : title.mode) === "server" ? unhead._title : void 0,
          titleTemplate: (titleTemplate == null ? void 0 : titleTemplate.mode) === "server" ? unhead._titleTemplate : void 0
        };
        if (Object.keys(unhead._ssrPayload || {}).length > 0) {
          payload = {
            ...unhead._ssrPayload,
            ...payload
          };
        }
        if (Object.values(payload).some(Boolean)) {
          ctx.tags.push({
            tag: "script",
            innerHTML: JSON.stringify(payload),
            props: { id: "unhead:payload", type: "application/json" }
          });
        }
      }
    }
  });
  return unhead;
}
// @__NO_SIDE_EFFECTS__
function createHead(options = {}) {
  const head = /* @__PURE__ */ createHead$1({
    ...options,
    propResolvers: [VueResolver]
  });
  head.install = /* @__PURE__ */ vueInstall(head);
  return head;
}
const ClientOnly = defineComponent({
  setup(props, { slots }) {
    const mounted = ref(false);
    onMounted(() => mounted.value = true);
    return () => {
      if (!mounted.value)
        return slots.placeholder && slots.placeholder({});
      return slots.default && slots.default({});
    };
  }
});
function ViteSSG(App, routerOptions, fn, options) {
  const {
    transformState,
    registerComponents = true,
    useHead: useHead2 = true,
    rootContainer = "#app"
  } = {};
  async function createApp$1(routePath) {
    const app = createSSRApp(App);
    let head;
    if (useHead2) {
      app.use(head = /* @__PURE__ */ createHead());
    }
    const router = createRouter({
      history: createMemoryHistory(routerOptions.base),
      ...routerOptions
    });
    const { routes: routes2 } = routerOptions;
    if (registerComponents)
      app.component("ClientOnly", ClientOnly);
    const appRenderCallbacks = [];
    const onSSRAppRendered = (cb) => appRenderCallbacks.push(cb);
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map((cb) => cb()));
    };
    const context = {
      app,
      head,
      isClient: false,
      router,
      routes: routes2,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath
    };
    await (fn == null ? void 0 : fn(context));
    app.use(router);
    let entryRoutePath;
    let isFirstRoute = true;
    router.beforeEach((to, from, next) => {
      if (isFirstRoute || entryRoutePath && entryRoutePath === to.path) {
        isFirstRoute = false;
        entryRoutePath = to.path;
        to.meta.state = context.initialState;
      }
      next();
    });
    {
      const route = context.routePath ?? "/";
      router.push(route);
      await router.isReady();
      context.initialState = router.currentRoute.value.meta.state || {};
    }
    const initialState = context.initialState;
    return {
      ...context,
      initialState
    };
  }
  return createApp$1;
}
const _imports_0 = "/images/use-cases/duplicate-clothes.png";
const _imports_1 = "/images/use-cases/online-preview.png";
const _imports_2 = "/images/use-cases/daily-outfit.png";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const _sfc_main$j = /* @__PURE__ */ defineComponent({
  __name: "Button",
  __ssrInlineRender: true,
  props: {
    variant: {},
    size: {},
    class: {},
    asChild: { type: Boolean },
    as: { default: "button" }
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(unref(Primitive), mergeProps({
        as: __props.as,
        "as-child": __props.asChild,
        class: unref(cn)(unref(buttonVariants)({ variant: __props.variant, size: __props.size }), props.class)
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            ssrRenderSlot(_ctx.$slots, "default", {}, null, _push2, _parent2, _scopeId);
          } else {
            return [
              renderSlot(_ctx.$slots, "default")
            ];
          }
        }),
        _: 3
      }, _parent));
    };
  }
});
const _sfc_setup$j = _sfc_main$j.setup;
_sfc_main$j.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ui/button/Button.vue");
  return _sfc_setup$j ? _sfc_setup$j(props, ctx) : void 0;
};
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        "default": "h-10 px-4 py-2",
        "sm": "h-9 rounded-md px-3",
        "lg": "h-11 rounded-md px-8",
        "icon": "h-10 w-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const _sfc_main$i = /* @__PURE__ */ defineComponent({
  __name: "Accordion",
  __ssrInlineRender: true,
  props: {
    collapsible: { type: Boolean },
    disabled: { type: Boolean },
    dir: {},
    orientation: {},
    unmountOnHide: { type: Boolean },
    asChild: { type: Boolean },
    as: {},
    type: {},
    modelValue: {},
    defaultValue: {}
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emits = __emit;
    const forwarded = useForwardPropsEmits(props, emits);
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(unref(AccordionRoot), mergeProps(unref(forwarded), _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            ssrRenderSlot(_ctx.$slots, "default", {}, null, _push2, _parent2, _scopeId);
          } else {
            return [
              renderSlot(_ctx.$slots, "default")
            ];
          }
        }),
        _: 3
      }, _parent));
    };
  }
});
const _sfc_setup$i = _sfc_main$i.setup;
_sfc_main$i.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ui/accordion/Accordion.vue");
  return _sfc_setup$i ? _sfc_setup$i(props, ctx) : void 0;
};
const _sfc_main$h = /* @__PURE__ */ defineComponent({
  __name: "AccordionContent",
  __ssrInlineRender: true,
  props: {
    forceMount: { type: Boolean },
    asChild: { type: Boolean },
    as: {},
    class: {}
  },
  setup(__props) {
    const props = __props;
    const delegatedProps = reactiveOmit(props, "class");
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(unref(AccordionContent), mergeProps(unref(delegatedProps), { class: "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<div class="${ssrRenderClass(unref(cn)("pb-4 pt-0", props.class))}"${_scopeId}>`);
            ssrRenderSlot(_ctx.$slots, "default", {}, null, _push2, _parent2, _scopeId);
            _push2(`</div>`);
          } else {
            return [
              createVNode("div", {
                class: unref(cn)("pb-4 pt-0", props.class)
              }, [
                renderSlot(_ctx.$slots, "default")
              ], 2)
            ];
          }
        }),
        _: 3
      }, _parent));
    };
  }
});
const _sfc_setup$h = _sfc_main$h.setup;
_sfc_main$h.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ui/accordion/AccordionContent.vue");
  return _sfc_setup$h ? _sfc_setup$h(props, ctx) : void 0;
};
const _sfc_main$g = /* @__PURE__ */ defineComponent({
  __name: "AccordionItem",
  __ssrInlineRender: true,
  props: {
    disabled: { type: Boolean },
    value: {},
    unmountOnHide: { type: Boolean },
    asChild: { type: Boolean },
    as: {},
    class: {}
  },
  setup(__props) {
    const props = __props;
    const delegatedProps = reactiveOmit(props, "class");
    const forwardedProps = useForwardProps(delegatedProps);
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(unref(AccordionItem), mergeProps(unref(forwardedProps), {
        class: unref(cn)("border-b", props.class)
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            ssrRenderSlot(_ctx.$slots, "default", {}, null, _push2, _parent2, _scopeId);
          } else {
            return [
              renderSlot(_ctx.$slots, "default")
            ];
          }
        }),
        _: 3
      }, _parent));
    };
  }
});
const _sfc_setup$g = _sfc_main$g.setup;
_sfc_main$g.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ui/accordion/AccordionItem.vue");
  return _sfc_setup$g ? _sfc_setup$g(props, ctx) : void 0;
};
const _sfc_main$f = /* @__PURE__ */ defineComponent({
  __name: "AccordionTrigger",
  __ssrInlineRender: true,
  props: {
    asChild: { type: Boolean },
    as: {},
    class: {}
  },
  setup(__props) {
    const props = __props;
    const delegatedProps = reactiveOmit(props, "class");
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(unref(AccordionHeader), mergeProps({ class: "flex" }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(ssrRenderComponent(unref(AccordionTrigger), mergeProps(unref(delegatedProps), {
              class: unref(cn)(
                "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                props.class
              )
            }), {
              default: withCtx((_2, _push3, _parent3, _scopeId2) => {
                if (_push3) {
                  ssrRenderSlot(_ctx.$slots, "default", {}, null, _push3, _parent3, _scopeId2);
                  ssrRenderSlot(_ctx.$slots, "icon", {}, () => {
                    _push3(ssrRenderComponent(unref(ChevronDown), { class: "h-4 w-4 shrink-0 transition-transform duration-200" }, null, _parent3, _scopeId2));
                  }, _push3, _parent3, _scopeId2);
                } else {
                  return [
                    renderSlot(_ctx.$slots, "default"),
                    renderSlot(_ctx.$slots, "icon", {}, () => [
                      createVNode(unref(ChevronDown), { class: "h-4 w-4 shrink-0 transition-transform duration-200" })
                    ])
                  ];
                }
              }),
              _: 3
            }, _parent2, _scopeId));
          } else {
            return [
              createVNode(unref(AccordionTrigger), mergeProps(unref(delegatedProps), {
                class: unref(cn)(
                  "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                  props.class
                )
              }), {
                default: withCtx(() => [
                  renderSlot(_ctx.$slots, "default"),
                  renderSlot(_ctx.$slots, "icon", {}, () => [
                    createVNode(unref(ChevronDown), { class: "h-4 w-4 shrink-0 transition-transform duration-200" })
                  ])
                ]),
                _: 3
              }, 16, ["class"])
            ];
          }
        }),
        _: 3
      }, _parent));
    };
  }
});
const _sfc_setup$f = _sfc_main$f.setup;
_sfc_main$f.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ui/accordion/AccordionTrigger.vue");
  return _sfc_setup$f ? _sfc_setup$f(props, ctx) : void 0;
};
const supabaseUrl = "https://eufhccrelpucppognlym.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZmhjY3JlbHB1Y3Bwb2dubHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzU4NjQsImV4cCI6MjA3OTYxMTg2NH0.9xB3Peua7MeaRGYPsSrmHYbpWpQmyqpJSSNqyGjqdIo";
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use localStorage for session persistence (survives page refresh)
    storage: typeof window !== "undefined" ? window.localStorage : void 0,
    // Ensure sessions are persisted to storage
    persistSession: true,
    // Automatically refresh tokens before expiration
    autoRefreshToken: true,
    // Detect session from URL (important for OAuth callbacks)
    detectSessionInUrl: true,
    // Use PKCE flow for better security (recommended for OAuth)
    flowType: "pkce"
  }
});
const useAuthStore = defineStore("auth", () => {
  const session = ref(null);
  const isLoading = ref(true);
  let unsubscribe = null;
  const isAuthenticated = computed(() => !!session.value);
  const user = computed(() => {
    var _a;
    return ((_a = session.value) == null ? void 0 : _a.user) ?? null;
  });
  const accessToken = computed(() => {
    var _a;
    return ((_a = session.value) == null ? void 0 : _a.access_token) ?? null;
  });
  const loadSession = async () => {
    var _a, _b, _c, _d, _e;
    if (typeof window !== "undefined") {
      fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "stores/auth.ts:18", message: "loadSession entry", data: { isLoading: isLoading.value, hasWindow: typeof window !== "undefined", existingToken: typeof window !== "undefined" ? ((_a = localStorage.getItem("auth_token")) == null ? void 0 : _a.substring(0, 20)) || null : null }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D,E" }) }).catch(() => {
      });
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("Failed to get Supabase session", error);
      if (typeof window !== "undefined") {
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "stores/auth.ts:23", message: "loadSession getSession error", data: { error: String(error) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
        });
      }
    }
    session.value = data.session ?? null;
    isLoading.value = false;
    if (typeof window !== "undefined") {
      fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "stores/auth.ts:28", message: "loadSession got session", data: { hasSession: !!session.value, hasToken: !!((_b = session.value) == null ? void 0 : _b.access_token), tokenPrefix: ((_d = (_c = session.value) == null ? void 0 : _c.access_token) == null ? void 0 : _d.substring(0, 20)) || null }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
      });
    }
    if (typeof window !== "undefined") {
      if ((_e = session.value) == null ? void 0 : _e.access_token) {
        localStorage.setItem("auth_token", session.value.access_token);
        if (typeof window !== "undefined") {
          fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "stores/auth.ts:35", message: "Saved token to localStorage", data: { tokenPrefix: session.value.access_token.substring(0, 20) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "A,C" }) }).catch(() => {
          });
        }
      } else {
        localStorage.removeItem("auth_token");
        if (typeof window !== "undefined") {
          fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "stores/auth.ts:40", message: "Removed token from localStorage", data: {}, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "C" }) }).catch(() => {
          });
        }
      }
    }
    return session.value;
  };
  const refreshSession = async () => {
    return await loadSession();
  };
  const setupAuthListener = () => {
    if (unsubscribe) return;
    unsubscribe = supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession;
      isLoading.value = false;
      if (typeof window !== "undefined") {
        if (newSession == null ? void 0 : newSession.access_token) {
          localStorage.setItem("auth_token", newSession.access_token);
        } else {
          localStorage.removeItem("auth_token");
        }
      }
    });
  };
  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe.data.subscription.unsubscribe();
      unsubscribe = null;
    }
  };
  if (typeof window !== "undefined") {
    setupAuthListener();
    loadSession();
  } else {
    isLoading.value = false;
  }
  return {
    // State
    session,
    isLoading,
    // Getters
    isAuthenticated,
    user,
    accessToken,
    // Actions
    loadSession,
    refreshSession,
    setupAuthListener,
    cleanup
  };
}, {
  // Persist configuration (only in browser, not in SSR)
  persist: typeof window !== "undefined" ? {
    key: "auth-store",
    storage: localStorage
  } : false
});
const siteBaseUrl = void 0;
const defaultSEO = {
  title: "Fashion Rec",
  description: "AI-powered virtual try-on, smart outfit recommendations, and personalized wardrobe management.",
  keywords: [
    "AI fashion",
    "virtual try-on",
    "wardrobe management",
    "outfit recommendations",
    "fashion ai",
    "try on clothes online"
  ].join(", "),
  author: "Fashion Rec",
  siteName: "Fashion Rec",
  twitterHandle: "@fashionrec",
  ogImage: `${siteBaseUrl}/images/brand/hdz.png`
};
function useSEO(options = {}) {
  const pageTitle = computed(() => options.title || defaultSEO.title);
  const description = computed(() => options.description || defaultSEO.description);
  const keywords = computed(() => options.keywords || defaultSEO.keywords);
  const author = computed(() => options.author || defaultSEO.author);
  const robots = computed(() => options.robots || "index,follow");
  const canonical = computed(() => {
    if (options.canonical) return options.canonical;
    const path = options.path || "/";
    return `${siteBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  });
  const image = computed(() => options.image || defaultSEO.ogImage);
  useHead({
    title: pageTitle.value,
    meta: [
      { name: "description", content: description.value },
      { name: "keywords", content: keywords.value },
      { name: "author", content: author.value },
      { name: "robots", content: robots.value },
      { property: "og:title", content: pageTitle.value },
      { property: "og:description", content: description.value },
      { property: "og:site_name", content: defaultSEO.siteName },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical.value },
      { property: "og:image", content: image.value },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle.value },
      { name: "twitter:description", content: description.value },
      { name: "twitter:image", content: image.value },
      { name: "twitter:site", content: defaultSEO.twitterHandle }
    ],
    link: [
      { rel: "canonical", href: canonical.value }
    ]
  });
}
const _sfc_main$e = /* @__PURE__ */ defineComponent({
  ...{ name: "Home" },
  __name: "Home",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const authStore = useAuthStore();
    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const isSettingVersion = ref(false);
    const API_URL2 = "http://localhost:8000";
    const setUserVersion = async (version = "v2") => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let token = session == null ? void 0 : session.access_token;
        if (!token) {
          const backupToken = localStorage.getItem("auth_token");
          if (backupToken) {
            token = backupToken;
            console.log("[Home] Using backup token from localStorage for setUserVersion");
          }
        }
        if (!token) {
          console.warn("[Home] No auth token available for setUserVersion");
          return false;
        }
        const response = await axios.post(
          `${API_URL2}/api/router/set-version`,
          { version },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            withCredentials: true
            // Include cookies
          }
        );
        return response.data.success === true;
      } catch (error) {
        console.error("Failed to set user version:", error);
        return false;
      }
    };
    const handleGetStarted = async () => {
      if (isAuthenticated.value) {
        isSettingVersion.value = true;
        try {
          await setUserVersion("v2");
        } catch (error) {
          console.warn("Failed to set user version, continuing anyway:", error);
        } finally {
          isSettingVersion.value = false;
        }
        router.push("/studio");
      } else {
        router.push("/login");
      }
    };
    const buttonText = computed(() => {
      return isAuthenticated.value ? "Enter Studio" : "Start for Free";
    });
    const faqs = [
      {
        question: "What is the difference between Fashion Rec and the many similar services already available in the market?",
        answer: "1. Fashion Rec is a service designed for individual users. 2. It features a smart wardrobe for convenient personal clothing management. 3. It is affordable, and free users can also enjoy full functionality."
      },
      {
        question: "How do I use the AI virtual try-on?",
        answer: "Upload your photo and the garments you want to try. Our AI will generate the try-on results automatically. You can start in the Studio page."
      },
      {
        question: "If I don't plan to pay, is this website useless to me?",
        answer: "Absolutely not. We believe people will always pay for quality service. Even if you subscribe to the free plan, you can still enjoy all core features."
      },
      {
        question: "What is the difference between Free and Premium?",
        answer: "The Free plan offers 2 try-on per day with core features and history saving. Premium includes more try-ons and advanced features."
      },
      {
        question: "Is my data safe?",
        answer: "We take privacy and security seriously. All uploaded photos and data are stored with encryption and never shared with third parties."
      },
      {
        question: "Which image formats are supported?",
        answer: "JPG, PNG, WEBP and other common formats are supported. Clear portrait photos provide the best results."
      },
      {
        question: "How do I manage my wardrobe?",
        answer: "After signing in, go to “My Wardrobe” to add, edit, or delete items."
      }
    ];
    useSEO({
      title: "Fashion Rec | Virtual Try-On & Smart Outfit Recommendations",
      description: "Build your AI-powered wardrobe, try on outfits virtually, and get personalized recommendations instantly.",
      path: "/",
      image: `${siteBaseUrl}/images/brand/hdz.png`
    });
    const faqSchema = computed(() => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }));
    const faqJsonLd = computed(() => JSON.stringify(faqSchema.value));
    useHead({
      script: [
        {
          type: "application/ld+json",
          children: faqJsonLd.value
        }
      ]
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-white" }, _attrs))}><main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12"><header class="text-center py-20" aria-label="Hero section"><h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl"> Your Style, Reimagined </h1><p class="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto"> AI-powered virtual try-on and personalized outfit recommendations. Discover your perfect look instantly with Fashion Rec. </p><div class="mt-10 flex items-center justify-center gap-x-6">`);
      _push(ssrRenderComponent(unref(_sfc_main$j), {
        onClick: handleGetStarted,
        variant: "default",
        disabled: isSettingVersion.value,
        class: "text-xl font-extrabold px-8 py-4 h-auto shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed",
        "aria-label": "Get started with Fashion Rec"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`${ssrInterpolate(isSettingVersion.value ? "Setting up..." : buttonText.value)}`);
          } else {
            return [
              createTextVNode(toDisplayString(isSettingVersion.value ? "Setting up..." : buttonText.value), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></header><section class="py-20 bg-gray-50"><div class="max-w-7xl mx-auto"><h2 class="text-3xl font-bold text-center mb-12 text-gray-900">Solve Your Fashion Challenges</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-8"><div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"><div class="aspect-[5/8] bg-gray-100 flex items-center justify-center"><img${ssrRenderAttr("src", _imports_0)} alt="Person organizing wardrobe to avoid duplicate purchases" class="w-full h-full object-cover"></div><div class="p-6"><h3 class="text-xl font-semibold mb-3 text-gray-900">Avoid Duplicate Purchases</h3><p class="text-gray-600"> Keep track of your wardrobe in one place. Our smart wardrobe management helps you remember what you own, preventing you from buying the same clothes twice. </p></div></div><div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"><div class="aspect-[5/8] bg-gray-100 flex items-center justify-center"><img${ssrRenderAttr("src", _imports_1)} alt="Person using phone to preview online clothes" class="w-full h-full object-cover"></div><div class="p-6"><h3 class="text-xl font-semibold mb-3 text-gray-900">Preview Before Buying</h3><p class="text-gray-600"> Unsure how that online purchase will look on you? Try it on virtually first. Our AI virtual try-on lets you see the fit and style before you buy. </p></div></div><div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"><div class="aspect-[5/8] bg-gray-100 flex items-center justify-center"><img${ssrRenderAttr("src", _imports_2)} alt="Person deciding what to wear today" class="w-full h-full object-cover"></div><div class="p-6"><h3 class="text-xl font-semibold mb-3 text-gray-900">Get Daily Outfit Ideas</h3><p class="text-gray-600"> Not sure what to wear today? Get personalized outfit recommendations based on your wardrobe, style preferences, and the occasion. </p></div></div></div></div></section><section class="py-20"><div class="grid grid-cols-1 md:grid-cols-3 gap-8"><div class="text-center"><div class="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4"><svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg></div><h3 class="text-xl font-semibold mb-2">Personalized Wardrobe</h3><p class="text-gray-600">Manage your closet and keep your outfit history.</p></div><div class="text-center"><div class="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4"><svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><h3 class="text-xl font-semibold mb-2">AI Virtual Try-On</h3><p class="text-gray-600">Advanced AI lets you preview outfits effortlessly.</p></div><div class="text-center"><div class="mx-auto h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-4"><svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></div><h3 class="text-xl font-semibold mb-2">Smart Recommendations</h3><p class="text-gray-600">Get outfit picks tailored to your style and preferences.</p></div></div></section></main><section class="bg-gray-50 py-20"><div class="container mx-auto px-4 sm:px-6 lg:px-8"><div class="max-w-3xl mx-auto"><h2 class="text-3xl font-bold text-center mb-12 text-gray-900">Frequently Asked Questions</h2>`);
      _push(ssrRenderComponent(unref(_sfc_main$i), {
        type: "single",
        collapsible: "",
        class: "w-full"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<!--[-->`);
            ssrRenderList(faqs, (faq, index) => {
              _push2(ssrRenderComponent(unref(_sfc_main$g), {
                key: index,
                value: `item-${index}`,
                class: "border-b border-gray-200"
              }, {
                default: withCtx((_2, _push3, _parent3, _scopeId2) => {
                  if (_push3) {
                    _push3(ssrRenderComponent(unref(_sfc_main$f), { class: "text-left font-semibold text-gray-900 hover:no-underline py-4" }, {
                      default: withCtx((_3, _push4, _parent4, _scopeId3) => {
                        if (_push4) {
                          _push4(`${ssrInterpolate(faq.question)}`);
                        } else {
                          return [
                            createTextVNode(toDisplayString(faq.question), 1)
                          ];
                        }
                      }),
                      _: 2
                    }, _parent3, _scopeId2));
                    _push3(ssrRenderComponent(unref(_sfc_main$h), { class: "text-gray-600 pb-4 pt-0" }, {
                      default: withCtx((_3, _push4, _parent4, _scopeId3) => {
                        if (_push4) {
                          _push4(`${ssrInterpolate(faq.answer)}`);
                        } else {
                          return [
                            createTextVNode(toDisplayString(faq.answer), 1)
                          ];
                        }
                      }),
                      _: 2
                    }, _parent3, _scopeId2));
                  } else {
                    return [
                      createVNode(unref(_sfc_main$f), { class: "text-left font-semibold text-gray-900 hover:no-underline py-4" }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(faq.question), 1)
                        ]),
                        _: 2
                      }, 1024),
                      createVNode(unref(_sfc_main$h), { class: "text-gray-600 pb-4 pt-0" }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(faq.answer), 1)
                        ]),
                        _: 2
                      }, 1024)
                    ];
                  }
                }),
                _: 2
              }, _parent2, _scopeId));
            });
            _push2(`<!--]-->`);
          } else {
            return [
              (openBlock(), createBlock(Fragment, null, renderList(faqs, (faq, index) => {
                return createVNode(unref(_sfc_main$g), {
                  key: index,
                  value: `item-${index}`,
                  class: "border-b border-gray-200"
                }, {
                  default: withCtx(() => [
                    createVNode(unref(_sfc_main$f), { class: "text-left font-semibold text-gray-900 hover:no-underline py-4" }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(faq.question), 1)
                      ]),
                      _: 2
                    }, 1024),
                    createVNode(unref(_sfc_main$h), { class: "text-gray-600 pb-4 pt-0" }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(faq.answer), 1)
                      ]),
                      _: 2
                    }, 1024)
                  ]),
                  _: 2
                }, 1032, ["value"]);
              }), 64))
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></div></section><footer class="bg-white border-t border-gray-200 py-12"><div class="container mx-auto px-4 sm:px-6 lg:px-8"><div class="max-w-4xl mx-auto"><h3 class="text-2xl font-bold text-center mb-8 text-gray-900">Follow Us</h3><div class="flex justify-center items-center gap-6 flex-wrap"><a href="https://x.com/hedongzhouu?s=21" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white transition-colors" aria-label="X"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg></a><a href="https://www.instagram.com/dongzhouhe?igsh=MXR5cmhpeHlzbHp6dw%3D%3D&amp;utm_source=qr" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-pink-500 hover:text-white transition-colors" aria-label="Instagram"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path></svg></a><a href="www.youtube.com/@dongzhouhe" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-red-600 hover:text-white transition-colors" aria-label="YouTube"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path></svg></a><a href="https://discord.gg/7cDGjf6S" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-indigo-600 hover:text-white transition-colors" aria-label="Discord"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"></path></svg></a></div><p class="text-center text-gray-600 mt-8 text-sm"> © 2025 Fashion Rec. All rights reserved. </p></div></div></footer></div>`);
    };
  }
});
const _sfc_setup$e = _sfc_main$e.setup;
_sfc_main$e.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Home.vue");
  return _sfc_setup$e ? _sfc_setup$e(props, ctx) : void 0;
};
const API_URL = "http://localhost:8000";
const SUBSCRIPTION_API_URL = "http://localhost:3001";
function createAuthenticatedApiClient(baseURL, timeout) {
  const client = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json"
    },
    timeout: timeout || 3e4
    // Default 30 seconds, can be overridden per request
  });
  client.interceptors.request.use(async (config) => {
    var _a, _b, _c, _d, _e, _f;
    if (typeof window === "undefined") {
      return config;
    }
    try {
      let token = null;
      if (typeof window !== "undefined") {
        token = localStorage.getItem("auth_token");
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          if (typeof window !== "undefined") {
            fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "api-client.ts:29", message: "Using token from localStorage (fast path)", data: { method: config.method, url: config.url, hasAuthHeader: !!((_a = config.headers) == null ? void 0 : _a.Authorization) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "C" }) }).catch(() => {
            });
          }
          if (false) ;
          return config;
        }
      }
      const authStore = useAuthStore();
      if (authStore.isLoading) {
        await authStore.loadSession();
      }
      token = authStore.accessToken;
      if (!token) {
        console.warn(`[API Client] No token in store, attempting to refresh session...`);
        await authStore.refreshSession();
        token = authStore.accessToken;
      }
      if (!token && typeof window !== "undefined") {
        const finalBackupToken = localStorage.getItem("auth_token");
        if (finalBackupToken) {
          token = finalBackupToken;
          console.log(`[API Client] Found token in localStorage after store check for ${(_b = config.method) == null ? void 0 : _b.toUpperCase()} ${config.url}`);
        }
      }
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        if (typeof window !== "undefined") {
          fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "api-client.ts:65", message: "Using token from auth store", data: { method: config.method, url: config.url, hasAuthHeader: !!((_c = config.headers) == null ? void 0 : _c.Authorization) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "A" }) }).catch(() => {
          });
        }
        if (false) ;
      } else {
        console.error("[API Client] No auth token available for request after all attempts:", (_d = config.method) == null ? void 0 : _d.toUpperCase(), config.url, "- Rejecting request");
        if (typeof window !== "undefined") {
          fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "api-client.ts:75", message: "Rejecting request - no token", data: { method: config.method, url: config.url, hasLocalStorageToken: !!(typeof window !== "undefined" ? localStorage.getItem("auth_token") : null) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "A,C" }) }).catch(() => {
          });
        }
        return Promise.reject(new Error("Authentication token not available. Please refresh the page or log in again."));
      }
    } catch (e) {
      console.warn("[API Client] Failed to get auth token for request:", e);
      if (typeof window !== "undefined") {
        const backupToken = localStorage.getItem("auth_token");
        if (backupToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${backupToken}`;
          console.log(`[API Client] Using backup token from localStorage after error for ${(_e = config.method) == null ? void 0 : _e.toUpperCase()} ${config.url}`);
          if (typeof window !== "undefined") {
            fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "api-client.ts:92", message: "Using backup token after error", data: { method: config.method, url: config.url }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "A,C" }) }).catch(() => {
            });
          }
          return config;
        }
      }
      console.error(`[API Client] No backup token available in localStorage after exception. Rejecting request for ${(_f = config.method) == null ? void 0 : _f.toUpperCase()} ${config.url}`);
      if (typeof window !== "undefined") {
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "api-client.ts:101", message: "No backup token after error - rejecting request", data: { method: config.method, url: config.url, error: String(e) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "A,C" }) }).catch(() => {
        });
      }
      return Promise.reject(new Error("Authentication token not available after exception. Please refresh the page or log in again."));
    }
    return config;
  });
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      var _a;
      const originalRequest = error.config;
      if (((_a = error.response) == null ? void 0 : _a.status) === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const authStore = useAuthStore();
          await authStore.refreshSession();
          const token = authStore.accessToken;
          if (token) {
            console.log("[API Client] Retrying request with refreshed session from auth store");
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          } else {
            console.warn("[API Client] No session available after 401, cannot retry");
            await supabase.auth.signOut();
            throw error;
          }
        } catch (refreshErr) {
          console.warn("[API Client] Failed to recover session after 401:", refreshErr);
          throw error;
        }
      }
      return Promise.reject(error);
    }
  );
  return client;
}
const apiClient = createAuthenticatedApiClient(API_URL);
createAuthenticatedApiClient(API_URL, 3e5);
createAuthenticatedApiClient(API_URL, 6e5);
const subscriptionClient = createAuthenticatedApiClient(SUBSCRIPTION_API_URL);
const _sfc_main$d = /* @__PURE__ */ defineComponent({
  ...{ name: "Studio" },
  __name: "Studio",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const router = useRouter();
    const uploadedItems = ref([]);
    const selectedItem = ref(null);
    const selectedItemIds = ref([]);
    const recommendations = ref([]);
    const agentOutfits = ref([]);
    const activeWardrobeIds = ref([]);
    const activeWardrobeRoleMap = ref(/* @__PURE__ */ new Map());
    const originalAppliedOutfit = ref(null);
    const modelImageFile = ref(null);
    const tryOnImageUrl = ref(null);
    const isGenerating = ref(false);
    const isTryingOn = ref(false);
    const customPrompt = ref("");
    const sceneImageFile = ref(null);
    const sceneImagePreviewUrl = ref(null);
    const sceneImageUrl = ref(null);
    const historicalSceneImages = ref([]);
    const historicalModelImages = ref([]);
    const showSceneImageHistory = ref(false);
    const showModelImageHistory = ref(false);
    const sceneImageUploadProgress = ref(0);
    const isUploadingSceneImage = ref(false);
    const modelImageUploadProgress = ref(0);
    const isUploadingModelImage = ref(false);
    const showModelImageError = ref(false);
    const subscriptionInfo = ref(null);
    const isLoadingSubscription = ref(false);
    const loadSubscriptionInfo = async () => {
      var _a;
      isLoadingSubscription.value = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Please sign in first");
        }
        const session = await supabase.auth.getSession();
        const response = await subscriptionClient.get("/subscription/status", {
          params: { user_id: user.id },
          headers: {
            Authorization: `Bearer ${((_a = session.data.session) == null ? void 0 : _a.access_token) || user.id}`
          }
        });
        subscriptionInfo.value = response.data;
      } catch (error) {
        console.error("Failed to load subscription info:", error);
        subscriptionInfo.value = {
          planName: "Free",
          remainingTries: 0,
          totalTries: 1,
          period: "daily"
        };
      } finally {
        isLoadingSubscription.value = false;
      }
    };
    const showImageViewer = ref(false);
    const currentImageIndex = ref(0);
    const imageViewerImages = ref([]);
    const saveItemsToCache = () => {
      try {
        sessionStorage.setItem("wardrobe_items_cache", JSON.stringify(uploadedItems.value));
      } catch (e) {
        console.warn("Failed to save items to sessionStorage:", e);
      }
    };
    const restoreItemsFromCache = () => {
      try {
        const cached = sessionStorage.getItem("wardrobe_items_cache");
        if (cached) {
          const items = JSON.parse(cached);
          if (Array.isArray(items) && items.length > 0) {
            uploadedItems.value = items;
            console.log("[Studio] Restored items from sessionStorage:", items.length);
            return true;
          }
        }
      } catch (e) {
        console.warn("Failed to restore items from sessionStorage:", e);
      }
      return false;
    };
    const loadUserItems = async () => {
      try {
        const response = await apiClient.get("/items");
        uploadedItems.value = response.data.items.map((item) => ({
          id: item.id,
          url: item.path,
          features: {
            path: item.path,
            type: item.type || "Unknown",
            color: item.color || "Unknown",
            style: item.style || "Unknown",
            pattern: item.pattern,
            occasion: item.occasion,
            material: item.material
          }
        }));
        saveItemsToCache();
        console.log("Loaded user items:", uploadedItems.value.length);
      } catch (error) {
        console.error("Failed to load user items:", error);
      }
    };
    const loadHistoricalImages = async () => {
      var _a, _b;
      try {
        console.log("[loadHistoricalImages] Starting to load historical images...");
        const [sceneResp, modelResp] = await Promise.all([
          apiClient.get("/user-images?image_type=scene"),
          apiClient.get("/user-images?image_type=model")
        ]);
        console.log("[loadHistoricalImages] Scene response:", sceneResp.data);
        console.log("[loadHistoricalImages] Model response:", modelResp.data);
        const sceneImages = ((_a = sceneResp.data) == null ? void 0 : _a.images) || sceneResp.data || [];
        const modelImages = ((_b = modelResp.data) == null ? void 0 : _b.images) || modelResp.data || [];
        historicalSceneImages.value = Array.isArray(sceneImages) ? sceneImages : [];
        historicalModelImages.value = Array.isArray(modelImages) ? modelImages : [];
        console.log("[loadHistoricalImages] Loaded scene images:", historicalSceneImages.value.length);
        console.log("[loadHistoricalImages] Loaded model images:", historicalModelImages.value.length);
      } catch (error) {
        console.error("[loadHistoricalImages] Failed to load historical images:", error);
      }
    };
    const handleKeyDown = (event) => {
      if (!showImageViewer.value) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevImage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextImage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeImageViewer();
      }
    };
    onMounted(async () => {
      syncSelectedItemsToActiveWardrobe();
      restoreItemsFromCache();
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await Promise.all([
            loadHistoricalImages(),
            loadSubscriptionInfo()
          ]);
        } else {
          console.warn("No session found on mount, but still attempting to load data");
          await Promise.all([
            loadHistoricalImages(),
            loadSubscriptionInfo()
          ]);
        }
      } catch (error) {
        console.error("Failed to check session on mount:", error);
        await Promise.all([
          loadHistoricalImages(),
          loadSubscriptionInfo()
        ]);
      }
      const lookId = route.query.lookId;
      if (lookId) {
        console.log("[onMounted] Found lookId in query, restoring look:", lookId);
        await restoreLookFromHistory(lookId);
      }
      const tryonHistoryId = route.query.tryonHistoryId;
      if (tryonHistoryId) {
        console.log("[onMounted] Found tryonHistoryId in query, restoring try-on history:", tryonHistoryId);
        await restoreTryOnHistory(tryonHistoryId);
      }
      window.addEventListener("keydown", handleKeyDown);
    });
    const syncSelectedItemsToActiveWardrobe = () => {
      try {
        const saved = localStorage.getItem("fashion_rec_selected_items");
        if (saved) {
          const ids = JSON.parse(saved);
          if (Array.isArray(ids)) {
            selectedItemIds.value = ids;
            const newIds = ids.filter((id) => !activeWardrobeIds.value.includes(String(id)));
            if (newIds.length > 0) {
              activeWardrobeIds.value.push(...newIds.map((id) => String(id)));
              console.log("[syncSelectedItemsToActiveWardrobe] Added new items to activeWardrobeIds:", newIds);
            }
          }
        }
      } catch (e) {
        console.error("Failed to sync selected items from localStorage:", e);
      }
    };
    onActivated(() => {
      syncSelectedItemsToActiveWardrobe();
      if (uploadedItems.value.length === 0) {
        const restored = restoreItemsFromCache();
        if (restored) {
          console.log("[Studio onActivated] Restored items from sessionStorage (from Wardrobe page)");
        } else {
          console.log("[Studio onActivated] No cached data - user hasn't selected items in Wardrobe yet");
        }
      } else {
        console.log("[Studio onActivated] Using cached data, items count:", uploadedItems.value.length);
      }
    });
    const restoreTryOnHistory = async (tryonHistoryId) => {
      try {
        console.log("[restoreTryOnHistory] Restoring try-on history:", tryonHistoryId);
        const restoreDataStr = sessionStorage.getItem("tryon_history_restore");
        if (!restoreDataStr) {
          console.warn("[restoreTryOnHistory] No restore data found in sessionStorage");
          return;
        }
        const restoreData = JSON.parse(restoreDataStr);
        if (restoreData.tryonHistoryId !== tryonHistoryId) {
          console.warn("[restoreTryOnHistory] History ID mismatch");
          return;
        }
        console.log("[restoreTryOnHistory] Loading historical images...");
        await loadHistoricalImages();
        console.log("[restoreTryOnHistory] Historical images loaded:", {
          model: historicalModelImages.value.length,
          scene: historicalSceneImages.value.length
        });
        if (uploadedItems.value.length === 0) {
          const restored = restoreItemsFromCache();
          if (!restored) {
            console.log("[restoreTryOnHistory] Loading items from backend to match garment URLs...");
            await loadUserItems();
          }
        }
        if (restoreData.prompt) {
          customPrompt.value = restoreData.prompt;
          console.log("[restoreTryOnHistory] Restored prompt:", restoreData.prompt);
        }
        if (restoreData.scene_image_url) {
          sceneImageUrl.value = restoreData.scene_image_url;
          sceneImagePreviewUrl.value = restoreData.scene_image_url;
          sceneImageFile.value = null;
          console.log("[restoreTryOnHistory] Restored scene image:", restoreData.scene_image_url);
        }
        if (restoreData.image_url) {
          tryOnImageUrl.value = restoreData.image_url;
          console.log("[restoreTryOnHistory] Restored try-on result image:", restoreData.image_url);
          await checkFavoriteStatus();
        }
        if (restoreData.model_image_url) {
          modelImagePreviewUrl.value = restoreData.model_image_url;
          modelImageFile.value = null;
          console.log("[restoreTryOnHistory] Restored model image from saved URL:", restoreData.model_image_url);
        } else if (restoreData.model_image_id) {
          const modelImage = historicalModelImages.value.find((img) => img.id === restoreData.model_image_id);
          if (modelImage) {
            modelImagePreviewUrl.value = modelImage.image_url;
            modelImageFile.value = null;
            console.log("[restoreTryOnHistory] Restored model image by ID:", modelImage.image_url);
          } else {
            console.log("[restoreTryOnHistory] Model image ID not found in history, trying time-based match...");
            const tryOnDate = new Date(restoreData.created_at);
            const modelImage2 = historicalModelImages.value.filter((img) => {
              const imgDate = new Date(img.created_at);
              const timeDiff = tryOnDate.getTime() - imgDate.getTime();
              return timeDiff >= 0 && timeDiff <= 24 * 60 * 60 * 1e3;
            }).sort((a, b) => {
              const aDiff = tryOnDate.getTime() - new Date(a.created_at).getTime();
              const bDiff = tryOnDate.getTime() - new Date(b.created_at).getTime();
              return aDiff - bDiff;
            })[0];
            if (modelImage2) {
              modelImagePreviewUrl.value = modelImage2.image_url;
              modelImageFile.value = null;
              console.log("[restoreTryOnHistory] Restored model image by time match:", modelImage2.image_url);
            }
          }
        } else {
          const tryOnDate = new Date(restoreData.created_at);
          console.log("[restoreTryOnHistory] Try-on date:", tryOnDate.toISOString());
          console.log("[restoreTryOnHistory] Available model images:", historicalModelImages.value.length);
          const modelImage = historicalModelImages.value.filter((img) => {
            const imgDate = new Date(img.created_at);
            const timeDiff = tryOnDate.getTime() - imgDate.getTime();
            return timeDiff >= 0 && timeDiff <= 24 * 60 * 60 * 1e3;
          }).sort((a, b) => {
            const aDiff = tryOnDate.getTime() - new Date(a.created_at).getTime();
            const bDiff = tryOnDate.getTime() - new Date(b.created_at).getTime();
            return aDiff - bDiff;
          })[0];
          if (modelImage) {
            modelImagePreviewUrl.value = modelImage.image_url;
            modelImageFile.value = null;
            console.log("[restoreTryOnHistory] Restored model image by time match:", modelImage.image_url);
          } else if (historicalModelImages.value.length > 0) {
            const mostRecent = historicalModelImages.value.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            modelImagePreviewUrl.value = mostRecent.image_url;
            modelImageFile.value = null;
            console.log("[restoreTryOnHistory] Using most recent model image as fallback:", mostRecent.image_url);
          } else {
            console.log("[restoreTryOnHistory] No model images available in history");
          }
        }
        if (restoreData.garment_urls && Array.isArray(restoreData.garment_urls) && restoreData.garment_urls.length > 0) {
          const matchedIds = [];
          restoreData.garment_urls.forEach((garmentUrl) => {
            const matchedItem = uploadedItems.value.find((item) => {
              const itemUrl = item.url || item.features.path;
              return itemUrl && (itemUrl === garmentUrl || itemUrl.includes(garmentUrl) || garmentUrl.includes(itemUrl));
            });
            if (matchedItem && matchedItem.id) {
              const id = String(matchedItem.id);
              if (!matchedIds.includes(id)) {
                matchedIds.push(id);
              }
            }
          });
          if (matchedIds.length > 0) {
            activeWardrobeIds.value = matchedIds;
            console.log("[restoreTryOnHistory] Restored wardrobe items:", matchedIds);
          } else {
            console.warn("[restoreTryOnHistory] Could not match garment URLs with wardrobe items");
          }
        }
        sessionStorage.removeItem("tryon_history_restore");
        const query = { ...route.query };
        delete query.tryonHistoryId;
        router.replace({ query });
        console.log("[restoreTryOnHistory] Successfully restored try-on history:", {
          prompt: customPrompt.value,
          sceneImageUrl: sceneImageUrl.value,
          tryOnImageUrl: tryOnImageUrl.value,
          activeWardrobeIds: activeWardrobeIds.value
        });
      } catch (error) {
        console.error("[restoreTryOnHistory] Failed to restore try-on history:", error);
        sessionStorage.removeItem("tryon_history_restore");
        const query = { ...route.query };
        delete query.tryonHistoryId;
        router.replace({ query });
      }
    };
    const restoreLookFromHistory = async (lookId) => {
      var _a, _b;
      try {
        console.log("[restoreLookFromHistory] Restoring look:", lookId);
        if (uploadedItems.value.length === 0) {
          const restored = restoreItemsFromCache();
          if (!restored) {
            console.log("[restoreLookFromHistory] No cached data, loading items from backend to restore look...");
            await loadUserItems();
          } else {
            console.log("[restoreLookFromHistory] Restored items from cache");
          }
        }
        const response = await apiClient.get(`/looks/${lookId}`);
        const look = response.data;
        console.log("[restoreLookFromHistory] Look data:", look);
        if (look.prompt) {
          customPrompt.value = look.prompt;
        }
        if (look.scene_image_url) {
          sceneImageUrl.value = look.scene_image_url;
          sceneImagePreviewUrl.value = look.scene_image_url;
          sceneImageFile.value = null;
        }
        if (look.items && Array.isArray(look.items)) {
          const validWardrobeIds = look.items.map((item) => item.wardrobe_id).filter((id) => !!id && typeof id === "string");
          const existingIds = validWardrobeIds.filter(
            (id) => uploadedItems.value.some((item) => String(item.id) === id)
          );
          activeWardrobeIds.value = existingIds;
          activeWardrobeRoleMap.value.clear();
          look.items.forEach((item) => {
            if (item.wardrobe_id && existingIds.includes(String(item.wardrobe_id))) {
              activeWardrobeRoleMap.value.set(String(item.wardrobe_id), item.role);
            }
          });
          originalAppliedOutfit.value = {
            title: look.title || "",
            items: look.items.map((item) => ({
              wardrobe_id: item.wardrobe_id || void 0,
              role: item.role,
              description: item.description || ""
            })),
            reason: look.reason || "",
            long_text: look.long_text || ""
          };
          console.log("[restoreLookFromHistory] Restored:", {
            wardrobeIds: activeWardrobeIds.value,
            roleMap: Array.from(activeWardrobeRoleMap.value.entries()),
            prompt: customPrompt.value,
            sceneImageUrl: sceneImageUrl.value
          });
        }
        const query = { ...route.query };
        delete query.lookId;
        router.replace({ query });
      } catch (error) {
        console.error("[restoreLookFromHistory] Failed to restore look:", error);
        alert(`Failed to restore look: ${((_b = (_a = error == null ? void 0 : error.response) == null ? void 0 : _a.data) == null ? void 0 : _b.detail) || (error == null ? void 0 : error.message) || "Unknown error"}`);
        const query = { ...route.query };
        delete query.lookId;
        router.replace({ query });
      }
    };
    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
    const formatFeatureValue = (value) => {
      if (!value) return "Unknown";
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return value;
    };
    const findWardrobeItemById = (wardrobeId) => {
      if (!wardrobeId) return null;
      return uploadedItems.value.find((it) => String(it.id) === String(wardrobeId)) || null;
    };
    const activeWardrobeItems = computed(
      () => activeWardrobeIds.value.map((id) => uploadedItems.value.find((it) => String(it.id) === id) || null).filter((it) => it !== null)
    );
    const modelImagePreviewUrl = ref(null);
    computed(
      () => selectedItemIds.value.map((id) => uploadedItems.value.find((it) => String(it.id) === id) || null).filter((it) => it !== null)
    );
    const getMissingRoles = () => {
      if (!originalAppliedOutfit.value) {
        return [];
      }
      const originalRoleCount = /* @__PURE__ */ new Map();
      originalAppliedOutfit.value.items.forEach((item) => {
        if (item.wardrobe_id) {
          const count = originalRoleCount.get(item.role) || 0;
          originalRoleCount.set(item.role, count + 1);
        }
      });
      const activeRoleCount = /* @__PURE__ */ new Map();
      activeWardrobeIds.value.forEach((id) => {
        const role = activeWardrobeRoleMap.value.get(String(id));
        if (role) {
          const count = activeRoleCount.get(role) || 0;
          activeRoleCount.set(role, count + 1);
        }
      });
      const missing = [];
      originalRoleCount.forEach((originalCount, role) => {
        const activeCount = activeRoleCount.get(role) || 0;
        if (activeCount < originalCount) {
          if (activeCount === 0) {
            missing.push(role);
          }
        }
      });
      return missing;
    };
    const closeImageViewer = () => {
      showImageViewer.value = false;
      imageViewerImages.value = [];
      currentImageIndex.value = 0;
    };
    const nextImage = () => {
      if (currentImageIndex.value < imageViewerImages.value.length - 1) {
        currentImageIndex.value++;
      } else {
        currentImageIndex.value = 0;
      }
    };
    const prevImage = () => {
      if (currentImageIndex.value > 0) {
        currentImageIndex.value--;
      } else {
        currentImageIndex.value = imageViewerImages.value.length - 1;
      }
    };
    const isSavingFavorite = ref(false);
    const favoriteSaved = ref(false);
    const currentFavoriteId = ref(null);
    const checkFavoriteStatus = async () => {
      if (!tryOnImageUrl.value) {
        favoriteSaved.value = false;
        currentFavoriteId.value = null;
        return;
      }
      try {
        const response = await apiClient.get("/favorites");
        const favorite = response.data.favorites.find((f) => f.image_url === tryOnImageUrl.value);
        if (favorite) {
          favoriteSaved.value = true;
          currentFavoriteId.value = favorite.id;
          console.log("[checkFavoriteStatus] Found existing favorite:", favorite.id);
        } else {
          favoriteSaved.value = false;
          currentFavoriteId.value = null;
        }
      } catch (error) {
        console.error("[checkFavoriteStatus] Failed to check favorite status:", error);
        favoriteSaved.value = false;
        currentFavoriteId.value = null;
      }
    };
    const getMissingItems = (outfit) => {
      return outfit.items.filter((item) => {
        if (!item.wardrobe_id) return true;
        return !findWardrobeItemById(item.wardrobe_id);
      });
    };
    const hasAnyWardrobeItem = (outfit) => {
      return outfit.items.some((item) => {
        if (!item.wardrobe_id) return false;
        return !!findWardrobeItemById(item.wardrobe_id);
      });
    };
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 font-sans text-gray-900" }, _attrs))}><main class="space-y-8"><section class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4"><div><h2 class="text-2xl font-bold mb-2">Tell AI about your day</h2><p class="text-sm text-gray-500"> Describe today’s weather, city, scene, and style preferences; AI will use your wardrobe to create outfits. </p></div><div class="flex flex-col gap-4"><div class="w-full space-y-3"><label class="block text-sm font-medium text-gray-700 mb-1"> Describe today and your style </label><div class="relative border border-gray-200 rounded-xl bg-white transition-all focus-within:border-gray-400 focus-within:shadow-md"><textarea rows="3" class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none border-0" placeholder="e.g., Minimalist commute vibe, avoid white shoes; or describe your scene and preferences.">${ssrInterpolate(customPrompt.value)}</textarea>`);
      if (sceneImagePreviewUrl.value || isUploadingSceneImage.value) {
        _push(`<div class="px-4 pb-2"><div class="relative inline-block group"><div class="w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">`);
        if (sceneImagePreviewUrl.value) {
          _push(`<img${ssrRenderAttr("src", sceneImagePreviewUrl.value)} alt="Scene preview" class="w-full h-full object-cover">`);
        } else {
          _push(`<!---->`);
        }
        if (isUploadingSceneImage.value) {
          _push(`<div class="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center"><div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div><span class="text-white text-xs">${ssrInterpolate(sceneImageUploadProgress.value)}%</span></div>`);
        } else {
          _push(`<!---->`);
        }
        if (isUploadingSceneImage.value) {
          _push(`<div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200"><div class="h-full bg-blue-500 transition-all duration-300" style="${ssrRenderStyle({ width: `${sceneImageUploadProgress.value}%` })}"></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
        if (sceneImagePreviewUrl.value && !isUploadingSceneImage.value) {
          _push(`<button class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md" title="Delete scene image">`);
          _push(ssrRenderComponent(unref(X), { class: "w-4 h-4" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="flex items-center justify-between px-4 py-2 border-t border-gray-100"><div class="flex items-center gap-2"><label for="sceneImageInput" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors" title="Upload a reference scene image">`);
      _push(ssrRenderComponent(unref(Upload), { class: "w-4 h-4" }, null, _parent));
      _push(`<span class="text-xs">Upload scene image (optional)</span></label><input id="sceneImageInput" type="file" accept="image/*" class="hidden"><button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors" title="Pick from scene history">`);
      _push(ssrRenderComponent(unref(Clock), { class: "w-4 h-4" }, null, _parent));
      _push(`<span class="text-xs">History</span></button></div></div></div><p class="text-xs text-gray-500 px-1"> Upload a photo of your environment (office, cafe, outdoors, etc.). AI will use it as the scene reference. </p>`);
      if (showSceneImageHistory.value) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"><div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"><div class="flex items-center justify-between p-6 border-b border-gray-200"><h3 class="text-lg font-semibold text-gray-900">Choose a historical scene image</h3><button class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">`);
        _push(ssrRenderComponent(unref(X), { class: "w-5 h-5 text-gray-500" }, null, _parent));
        _push(`</button></div><div class="flex-1 overflow-y-auto p-6">`);
        if (historicalSceneImages.value.length === 0) {
          _push(`<div class="text-center py-12 text-gray-400">`);
          _push(ssrRenderComponent(unref(Clock), { class: "w-12 h-12 mx-auto mb-3 text-gray-300" }, null, _parent));
          _push(`<p>No historical scene images</p></div>`);
        } else {
          _push(`<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"><!--[-->`);
          ssrRenderList(historicalSceneImages.value, (image) => {
            _push(`<div class="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg"><img${ssrRenderAttr("src", image.image_url)}${ssrRenderAttr("alt", `Scene image ${image.id}`)} class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div><button class="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10" title="Delete this image">`);
            _push(ssrRenderComponent(unref(Trash2), { class: "w-4 h-4" }, null, _parent));
            _push(`</button><div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><div class="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-gray-700">${ssrInterpolate(new Date(image.created_at).toLocaleDateString("en-US"))}</div></div></div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`</div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><div class="flex flex-col sm:flex-row items-start sm:items-center gap-3"><button${ssrIncludeBooleanAttr(isGenerating.value) ? " disabled" : ""} class="bg-black text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg shadow-black/20 w-full justify-center sm:w-auto">`);
      _push(ssrRenderComponent(unref(Wand2), { class: "w-5 h-5" }, null, _parent));
      _push(` ${ssrInterpolate(isGenerating.value ? "AI is Thinking..." : "Generate Outfit")}</button><div class="flex items-center gap-2 text-xs text-gray-500"><span class="font-medium text-gray-700">fashion</span><span class="text-gray-400">|</span><span>Powered by Qwen</span><span class="text-gray-400">|</span><span class="text-gray-400">Independent service</span></div></div>`);
      if (agentOutfits.value.length && !isGenerating.value) {
        _push(`<div class="mt-6 space-y-6"><div><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-semibold">AI Outfit Plans</h3><div class="flex items-center gap-2 text-xs text-gray-500"><span class="font-medium text-gray-700">fashion</span><span class="text-gray-400">|</span><span>Powered by Qwen</span><span class="text-gray-400">|</span><span class="text-gray-400">Independent service</span></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><!--[-->`);
        ssrRenderList(agentOutfits.value, (outfit, idx) => {
          _push(`<div class="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col justify-between"><div><h4 class="font-semibold text-sm mb-2">${ssrInterpolate(outfit.title)}</h4><ul class="text-xs text-gray-700 space-y-1 mb-2"><!--[-->`);
          ssrRenderList(outfit.items, (it, i) => {
            _push(`<li class="flex items-start justify-between gap-2"><div class="flex-1"><span class="font-medium capitalize">${ssrInterpolate(it.role)}:</span><span>${ssrInterpolate(it.description)}</span>`);
            if (findWardrobeItemById(it.wardrobe_id)) {
              _push(`<span class="text-green-600 ml-1">(in wardrobe)</span>`);
            } else {
              _push(`<!---->`);
            }
            if (it.wardrobe_id && activeWardrobeIds.value.includes(String(it.wardrobe_id))) {
              _push(`<span class="text-blue-600 ml-1">(selected)</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div>`);
            if (!findWardrobeItemById(it.wardrobe_id)) {
              _push(`<button class="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"${ssrRenderAttr("title", `Search for ${it.description} on Google`)}>`);
              _push(ssrRenderComponent(unref(Search), { class: "w-3.5 h-3.5 text-gray-600" }, null, _parent));
              _push(`</button>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</li>`);
          });
          _push(`<!--]--></ul><p class="text-xs text-gray-500 mb-2">${ssrInterpolate(outfit.reason)}</p><p class="text-xs text-gray-500 whitespace-pre-line">${ssrInterpolate(outfit.long_text)}</p></div><div class="mt-3 flex flex-col gap-2">`);
          if (hasAnyWardrobeItem(outfit)) {
            _push(`<button type="button" class="text-xs px-3 py-1 rounded-full border border-blue-400 text-blue-600 hover:border-blue-600 hover:text-blue-700 transition-colors self-end"> Apply outfit </button>`);
          } else {
            _push(`<!---->`);
          }
          if (getMissingItems(outfit).length > 0) {
            _push(`<div class="flex flex-wrap gap-2"><!--[-->`);
            ssrRenderList(getMissingItems(outfit), (missingItem, idx2) => {
              _push(`<button class="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-1">`);
              _push(ssrRenderComponent(unref(Search), { class: "w-3 h-3" }, null, _parent));
              _push(`<span>Search ${ssrInterpolate(missingItem.role)}</span></button>`);
            });
            _push(`<!--]--></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        });
        _push(`<!--]--></div></div></div>`);
      } else if (isGenerating.value) {
        _push(`<div class="mt-6 py-12 flex flex-col items-center justify-center"><div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-gray-500 animate-pulse mb-2">Consulting fashion knowledge base...</p><div class="flex items-center gap-2 text-xs text-gray-400"><span class="font-medium text-gray-600">fashion</span><span>|</span><span>Powered by Qwen</span><span>|</span><span>Independent service</span></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></section><section class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4"><div><h2 class="text-2xl font-bold mb-2">Applied Outfit Items</h2><p class="text-sm text-gray-500"> Items currently in this outfit. Remove items or generate suggestions for missing roles. </p></div><div class="p-4 border border-gray-100 rounded-xl bg-gray-50/50"><div class="flex items-center justify-between mb-3"><p class="text-sm font-medium text-gray-700"> Applied outfit items (${ssrInterpolate(activeWardrobeItems.value.length)}) </p>`);
      if (getMissingRoles().length > 0) {
        _push(`<p class="text-xs text-blue-600">${ssrInterpolate(getMissingRoles().length)} roles removed; re-generate to fill them. </p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (activeWardrobeItems.value.length === 0) {
        _push(`<div class="py-8 text-center">`);
        _push(ssrRenderComponent(unref(Shirt), { class: "w-12 h-12 mx-auto mb-3 text-gray-300" }, null, _parent));
        _push(`<p class="text-sm text-gray-500 mb-2">No items selected yet</p><p class="text-xs text-gray-400 mb-4">Go to Wardrobe and add items to the Outfit Generator.</p><button class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:border-black hover:text-black transition-colors">`);
        _push(ssrRenderComponent(unref(Shirt), { class: "w-4 h-4" }, null, _parent));
        _push(` Go to Wardrobe </button></div>`);
      } else {
        _push(`<div class="flex flex-wrap gap-3 mb-3"><!--[-->`);
        ssrRenderList(activeWardrobeItems.value, (item, index) => {
          _push(`<div class="group relative"><div class="relative"><div class="cursor-pointer"><div class="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-all hover:shadow-lg bg-gray-200">`);
          if (item.url || item.features.path) {
            _push(`<img${ssrRenderAttr("src", item.url || item.features.path)} class="w-full h-full object-cover"${ssrRenderAttr("alt", `${formatFeatureValue(item.features.color)} ${formatFeatureValue(item.features.type)}`)}>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg pointer-events-none"></div></div><button class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md z-10" title="删除此单品">`);
          _push(ssrRenderComponent(unref(X), { class: "w-4 h-4" }, null, _parent));
          _push(`</button></div><div class="mt-1 text-center"><p class="text-xs text-gray-600 truncate max-w-[80px]">${ssrInterpolate(formatFeatureValue(item.features.color))} ${ssrInterpolate(formatFeatureValue(item.features.type))}</p>`);
          if (activeWardrobeRoleMap.value.get(String(item.id))) {
            _push(`<p class="text-xs text-gray-400 truncate max-w-[80px]">${ssrInterpolate(activeWardrobeRoleMap.value.get(String(item.id)))}</p>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        });
        _push(`<!--]--></div>`);
      }
      _push(`</div></section><section class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-8"><div><h2 class="text-2xl font-bold mb-2">Review outfits &amp; try on</h2><p class="text-sm text-gray-500"> 先从衣橱中选择你想要的单品，让 AI 补齐整套穿搭，然后上传模特照片进行虚拟试穿。 </p></div><div data-model-uploader class="${ssrRenderClass([
        "border rounded-xl bg-white transition-all focus-within:shadow-md overflow-hidden",
        showModelImageError.value ? "border-red-500 border-2 shadow-red-200" : "border-gray-200 focus-within:border-gray-400"
      ])}">`);
      if (modelImagePreviewUrl.value || isUploadingModelImage.value) {
        _push(`<div class="p-4"><div class="flex items-center justify-between mb-3"><div><p class="text-sm font-medium text-gray-700 mb-1">Model photo</p><p class="text-xs text-gray-500"> Upload a half-body or full-body photo of you. All try-ons will use this model photo. </p></div>`);
        if (modelImagePreviewUrl.value && !isUploadingModelImage.value) {
          _push(`<button class="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md flex-shrink-0" title="Delete model photo">`);
          _push(ssrRenderComponent(unref(X), { class: "w-4 h-4" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">`);
        if (modelImagePreviewUrl.value) {
          _push(`<img${ssrRenderAttr("src", modelImagePreviewUrl.value)} alt="Model preview" class="w-full h-full object-cover">`);
        } else {
          _push(`<!---->`);
        }
        if (isUploadingModelImage.value) {
          _push(`<div class="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center"><div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div><span class="text-white text-xs">${ssrInterpolate(modelImageUploadProgress.value)}%</span></div>`);
        } else {
          _push(`<!---->`);
        }
        if (isUploadingModelImage.value) {
          _push(`<div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200"><div class="h-full bg-blue-500 transition-all duration-300" style="${ssrRenderStyle({ width: `${modelImageUploadProgress.value}%` })}"></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<div class="p-8"><div class="text-center">`);
        if (!recommendations.value.length && !agentOutfits.value.length && !isGenerating.value) {
          _push(ssrRenderComponent(unref(Wand2), { class: "w-12 h-12 mx-auto mb-3 text-gray-300" }, null, _parent));
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex flex-col items-center gap-3"><div class="flex items-center gap-3"><label for="modelImageInput" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer transition-colors">`);
        _push(ssrRenderComponent(unref(Upload), { class: "w-4 h-4" }, null, _parent));
        _push(`<span>Upload new photo</span></label><input id="modelImageInput" type="file" accept="image/*" class="hidden">`);
        if (historicalModelImages.value.length > 0) {
          _push(`<button class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer transition-colors">`);
          _push(ssrRenderComponent(unref(Clock), { class: "w-4 h-4" }, null, _parent));
          _push(`<span>History</span></button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><p class="text-xs text-gray-400"> Upload a half-body or full-body photo; all try-ons will use this model photo. </p></div></div></div>`);
      }
      if (modelImagePreviewUrl.value) {
        _push(`<div class="px-4 pb-4 border-t border-gray-100 pt-3"><div class="flex items-center gap-2"><label for="modelImageInputReplace" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors">`);
        _push(ssrRenderComponent(unref(Upload), { class: "w-4 h-4" }, null, _parent));
        _push(`<span>Replace photo</span></label><input id="modelImageInputReplace" type="file" accept="image/*" class="hidden">`);
        if (historicalModelImages.value.length > 0) {
          _push(`<button class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors">`);
          _push(ssrRenderComponent(unref(Clock), { class: "w-4 h-4" }, null, _parent));
          _push(`<span>History</span></button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (showModelImageHistory.value) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"><div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"><div class="flex items-center justify-between p-6 border-b border-gray-200"><h3 class="text-lg font-semibold text-gray-900">Choose a historical model image</h3><button class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">`);
        _push(ssrRenderComponent(unref(X), { class: "w-5 h-5 text-gray-500" }, null, _parent));
        _push(`</button></div><div class="flex-1 overflow-y-auto p-6">`);
        if (historicalModelImages.value.length === 0) {
          _push(`<div class="text-center py-12 text-gray-400">`);
          _push(ssrRenderComponent(unref(Clock), { class: "w-12 h-12 mx-auto mb-3 text-gray-300" }, null, _parent));
          _push(`<p>No historical model images</p></div>`);
        } else {
          _push(`<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"><!--[-->`);
          ssrRenderList(historicalModelImages.value, (image) => {
            _push(`<div class="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg"><img${ssrRenderAttr("src", image.image_url)}${ssrRenderAttr("alt", `Model image ${image.id}`)} class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div><button class="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10" title="Delete this image">`);
            _push(ssrRenderComponent(unref(Trash2), { class: "w-4 h-4" }, null, _parent));
            _push(`</button><div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><div class="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-gray-700">${ssrInterpolate(new Date(image.created_at).toLocaleDateString("en-US"))}</div></div></div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`</div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (activeWardrobeItems.value.length) {
        _push(`<div class="p-4 border border-gray-100 rounded-xl bg-gray-50/50"><div class="flex items-center justify-between mb-3"><div><p class="text-sm font-medium text-gray-700 mb-1">Ready to try on</p><p class="text-xs text-gray-500">${ssrInterpolate(activeWardrobeItems.value.length)} items selected. Click below to generate a virtual try-on. </p></div></div><div class="flex flex-col sm:flex-row sm:items-center gap-3"><button${ssrIncludeBooleanAttr(!activeWardrobeItems.value.length || isTryingOn.value) ? " disabled" : ""} class="px-4 py-2 rounded-lg border border-purple-500 text-purple-600 hover:border-purple-700 hover:text-purple-800 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">`);
        if (!isTryingOn.value) {
          _push(ssrRenderComponent(unref(Wand2), { class: "w-4 h-4" }, null, _parent));
        } else {
          _push(`<div class="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>`);
        }
        _push(`<span>${ssrInterpolate(isTryingOn.value ? "Generating try-on..." : "Try on this outfit")}</span></button><div class="flex items-center gap-2 text-xs text-gray-500"><span class="font-medium text-gray-700">fashion</span><span class="text-gray-400">|</span><span>Powered by Qwen</span><span class="text-gray-400">|</span><span class="text-gray-400">Independent service</span></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (isTryingOn.value && !tryOnImageUrl.value) {
        _push(`<div class="py-12 flex flex-col items-center justify-center border border-gray-100 rounded-xl bg-gray-50"><div class="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-gray-500 animate-pulse mb-2">Generating virtual try-on...</p><div class="flex items-center gap-2 text-xs text-gray-400"><span class="font-medium text-gray-600">fashion</span><span>|</span><span>Powered by Qwen</span><span>|</span><span>Independent service</span></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (selectedItem.value && recommendations.value.length > 0) {
        _push(`<div><h3 class="text-lg font-semibold mb-4">AI Suggestions</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><!--[-->`);
        ssrRenderList(recommendations.value, (rec) => {
          _push(`<div class="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow"><div class="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center text-gray-400 overflow-hidden">`);
          if (rec.path && rec.path.startsWith("http")) {
            _push(`<img${ssrRenderAttr("src", rec.path)} class="w-full h-full object-cover">`);
          } else {
            _push(`<span>${ssrInterpolate(rec.type)}</span>`);
          }
          _push(`</div><p class="font-medium text-sm">${ssrInterpolate(rec.color)} ${ssrInterpolate(rec.type)}</p><p class="text-xs text-gray-500 mt-1">${ssrInterpolate(rec.reason)}</p><p class="text-xs text-green-600 mt-1 font-medium">Match: ${ssrInterpolate(Math.round(rec.score * 100))}%</p></div>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (tryOnImageUrl.value) {
        _push(`<div class="border-t border-gray-100 pt-6"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-semibold">Virtual Try-On Result</h3><button${ssrIncludeBooleanAttr(isSavingFavorite.value) ? " disabled" : ""} class="${ssrRenderClass([
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
          favoriteSaved.value ? "bg-green-50 text-green-600 border border-green-200" : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300",
          isSavingFavorite.value && "opacity-50 cursor-not-allowed"
        ])}">`);
        _push(ssrRenderComponent(unref(Heart), {
          class: [
            "w-4 h-4 transition-all",
            favoriteSaved.value ? "fill-current text-green-600" : ""
          ]
        }, null, _parent));
        if (isSavingFavorite.value) {
          _push(`<span>Saving...</span>`);
        } else if (favoriteSaved.value) {
          _push(`<span>Saved</span>`);
        } else {
          _push(`<span>Favorite</span>`);
        }
        _push(`</button></div><div class="w-full max-w-md mx-auto rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300 transition-colors"><img${ssrRenderAttr("src", tryOnImageUrl.value)} alt="Try-on result" class="w-full object-contain"></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</section></main><footer class="mt-12 pt-8 border-t border-gray-200 pb-8"><div class="flex justify-center gap-6 text-sm text-gray-500">`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/privacy-policy",
        class: "hover:text-black transition-colors"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` Privacy Policy `);
          } else {
            return [
              createTextVNode(" Privacy Policy ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<span class="text-gray-300">|</span>`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/terms-of-service",
        class: "hover:text-black transition-colors"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` Terms of Service `);
          } else {
            return [
              createTextVNode(" Terms of Service ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div><p class="text-center text-xs text-gray-400 mt-4"> © 2025 Fashion Rec. All rights reserved. </p></footer>`);
      if (showImageViewer.value && imageViewerImages.value.length > 0) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"><div class="relative w-full h-full flex items-center justify-center p-4"><button class="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
        _push(ssrRenderComponent(unref(X), { class: "w-6 h-6" }, null, _parent));
        _push(`</button>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronLeft), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="max-w-4xl max-h-[90vh] flex items-center justify-center"><img${ssrRenderAttr("src", imageViewerImages.value[currentImageIndex.value])} alt="Outfit item" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"></div>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronRight), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        if (imageViewerImages.value.length > 1) {
          _push(`<div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">${ssrInterpolate(currentImageIndex.value + 1)} / ${ssrInterpolate(imageViewerImages.value.length)}</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$d = _sfc_main$d.setup;
_sfc_main$d.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Studio.vue");
  return _sfc_setup$d ? _sfc_setup$d(props, ctx) : void 0;
};
const _sfc_main$c = /* @__PURE__ */ defineComponent({
  ...{ name: "Login" },
  __name: "Login",
  __ssrInlineRender: true,
  setup(__props) {
    useRouter();
    const email = ref("");
    const password = ref("");
    const isLoading = ref(false);
    const message = ref("");
    const isSignUp = ref(false);
    const isForgotPassword = ref(false);
    const resetEmail = ref("");
    const showResendConfirmation = ref(false);
    const resendCooldown = ref(0);
    const resendTimer = ref(null);
    onUnmounted(() => {
      if (resendTimer.value) {
        clearInterval(resendTimer.value);
        resendTimer.value = null;
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen flex items-center justify-center bg-gray-50 p-4" }, _attrs))}><div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"><h1 class="text-3xl font-bold mb-2 text-center">Welcome</h1><p class="text-gray-500 mb-8 text-center">${ssrInterpolate(isForgotPassword.value ? "Reset password" : isSignUp.value ? "Create account" : "Sign in to access your AI wardrobe")}</p>`);
      if (isForgotPassword.value) {
        _push(`<div class="space-y-4"><input${ssrRenderAttr("value", resetEmail.value)} type="email" placeholder="Enter your email address" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">${ssrInterpolate(isLoading.value ? "Sending..." : "Send reset link")}</button>`);
        if (message.value) {
          _push(`<p class="${ssrRenderClass([message.value.toLowerCase().includes("sent") ? "text-green-600" : "text-red-600", "text-sm text-center"])}">${ssrInterpolate(message.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="pt-4 border-t border-gray-200"><button class="w-full text-sm text-gray-600 hover:text-black transition-colors"> ← 返回登录 </button></div></div>`);
      } else {
        _push(`<div class="space-y-4"><input${ssrRenderAttr("value", email.value)} type="email" placeholder="Enter email" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"><input${ssrRenderAttr("value", password.value)} type="password" placeholder="Enter password" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"><div class="flex justify-end"><button class="text-sm text-gray-600 hover:text-black transition-colors"> Forgot password? </button></div><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">${ssrInterpolate(isLoading.value ? isSignUp.value ? "Signing up..." : "Signing in..." : isSignUp.value ? "Sign up" : "Sign in")}</button><div class="relative my-6"><div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200"></div></div><div class="relative flex justify-center text-sm"><span class="px-2 bg-white text-gray-500">Or continue with</span></div></div><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg><span>Continue with Google</span></button>`);
        if (message.value) {
          _push(`<p class="${ssrRenderClass([message.value.toLowerCase().includes("success") || message.value.toLowerCase().includes("sent") ? "text-green-600" : "text-red-600", "text-sm text-center"])}">${ssrInterpolate(message.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        if (showResendConfirmation.value) {
          _push(`<div class="pt-2"><button${ssrIncludeBooleanAttr(isLoading.value || resendCooldown.value > 0) ? " disabled" : ""} class="w-full text-sm text-gray-600 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed underline">${ssrInterpolate(resendCooldown.value > 0 ? `Resend confirmation email (wait ${resendCooldown.value}s)` : "Didn't receive the email? Resend confirmation")}</button></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="pt-4 border-t border-gray-200"><button class="w-full text-sm text-gray-600 hover:text-black transition-colors">${ssrInterpolate(isSignUp.value ? "Already have an account? Sign in" : "Need an account? Sign up")}</button></div></div>`);
      }
      _push(`<div class="mt-6 pt-4 border-t border-gray-200 flex justify-center gap-4 text-xs text-gray-500">`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/privacy-policy",
        class: "hover:text-black transition-colors"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` Privacy Policy `);
          } else {
            return [
              createTextVNode(" Privacy Policy ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<span class="text-gray-300">|</span>`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/terms-of-service",
        class: "hover:text-black transition-colors"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` Terms of Service `);
          } else {
            return [
              createTextVNode(" Terms of Service ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></div></div>`);
    };
  }
});
const _sfc_setup$c = _sfc_main$c.setup;
_sfc_main$c.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Login.vue");
  return _sfc_setup$c ? _sfc_setup$c(props, ctx) : void 0;
};
const _sfc_main$b = /* @__PURE__ */ defineComponent({
  ...{ name: "Callback" },
  __name: "Callback",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const route = useRoute();
    const error = ref("");
    const isPasswordReset = ref(false);
    onMounted(async () => {
      try {
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.substring(1));
        const type = route.query.type || hashParams.get("type");
        if (type === "recovery" || hash.includes("type=recovery")) {
          isPasswordReset.value = true;
          router.push(`/reset-password${hash}`);
          return;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          const hash2 = window.location.hash;
          if (hash2 && hash2.includes("access_token")) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const { data: retryData, error: retryError } = await supabase.auth.getSession();
            if (retryError) throw retryError;
            if (retryData.session) {
              localStorage.setItem("auth_token", retryData.session.access_token);
              router.push("/studio");
              return;
            }
          }
          throw sessionError;
        }
        if (data.session) {
          localStorage.setItem("auth_token", data.session.access_token);
          router.push("/studio");
        } else {
          error.value = "No session found. Please check your email confirmation link or try signing in again.";
          setTimeout(() => router.push("/login"), 3e3);
        }
      } catch (err) {
        console.error("Callback error:", err);
        error.value = err.message || "Authentication failed";
        setTimeout(() => router.push("/login"), 2e3);
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen flex items-center justify-center bg-gray-50 p-4" }, _attrs))}><div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">`);
      if (!error.value) {
        _push(`<div><div class="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p class="text-gray-600">Completing sign-in...</p></div>`);
      } else {
        _push(`<div class="text-red-600"><p class="font-medium mb-2">${ssrInterpolate(error.value)}</p><p class="text-sm text-gray-500 mt-2">If you just confirmed your email, please try signing in.</p><p class="text-sm text-gray-500 mt-1">Redirecting to login...</p></div>`);
      }
      _push(`</div></div>`);
    };
  }
});
const _sfc_setup$b = _sfc_main$b.setup;
_sfc_main$b.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Callback.vue");
  return _sfc_setup$b ? _sfc_setup$b(props, ctx) : void 0;
};
const _sfc_main$a = /* @__PURE__ */ defineComponent({
  ...{ name: "ResetPassword" },
  __name: "ResetPassword",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const password = ref("");
    const confirmPassword = ref("");
    const isLoading = ref(false);
    const message = ref("");
    const isValidToken = ref(false);
    onMounted(async () => {
      try {
        const hash = window.location.hash;
        if (hash) {
          const { data: { session: session2 }, error: error2 } = await supabase.auth.getSession();
          if (error2) throw error2;
          if (session2) {
            isValidToken.value = true;
            return;
          }
        }
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) {
          isValidToken.value = true;
        } else {
          message.value = "The reset link is invalid or expired. Please request again.";
          setTimeout(() => router.push("/login"), 3e3);
        }
      } catch (err) {
        console.error("Session check error:", err);
        message.value = "Unable to verify reset link. Please request a new one.";
        setTimeout(() => router.push("/login"), 3e3);
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen flex items-center justify-center bg-gray-50 p-4" }, _attrs))}><div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"><h1 class="text-3xl font-bold mb-2 text-center">Reset Password</h1><p class="text-gray-500 mb-8 text-center">Enter your new password</p>`);
      if (isValidToken.value) {
        _push(`<div class="space-y-4"><input${ssrRenderAttr("value", password.value)} type="password" placeholder="Enter new password (min 6 characters)" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"><input${ssrRenderAttr("value", confirmPassword.value)} type="password" placeholder="Confirm new password" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">${ssrInterpolate(isLoading.value ? "Resetting..." : "Reset password")}</button>`);
        if (message.value) {
          _push(`<p class="${ssrRenderClass([message.value.toLowerCase().includes("successful") ? "text-green-600" : "text-red-600", "text-sm text-center"])}">${ssrInterpolate(message.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<div class="text-center"><div class="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p class="text-red-600 mb-2">${ssrInterpolate(message.value || "Validating reset link...")}</p><p class="text-sm text-gray-500">Redirecting to sign-in page</p></div>`);
      }
      _push(`</div></div>`);
    };
  }
});
const _sfc_setup$a = _sfc_main$a.setup;
_sfc_main$a.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ResetPassword.vue");
  return _sfc_setup$a ? _sfc_setup$a(props, ctx) : void 0;
};
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  ...{ name: "Wardrobe" },
  __name: "Wardrobe",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const uploadedItems = ref([]);
    const hasLoadedItems = ref(false);
    const typeFilters = ["All", "Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories", "Sportswear", "Traditional"];
    const selectedFilter = ref("All");
    const isUploading = ref(false);
    const uploadProgress = ref(null);
    const pendingItems = ref([]);
    const showConfirmDialog = ref(false);
    const isConfirming = ref(false);
    ref(null);
    const imageUrlInput = ref("");
    const isUploadingUrl = ref(false);
    const selectedForOutfitIds = ref(/* @__PURE__ */ new Set());
    const loadOutfitSelection = () => {
      try {
        const saved = localStorage.getItem("fashion_rec_selected_items");
        if (saved) {
          const ids = JSON.parse(saved);
          if (Array.isArray(ids)) {
            selectedForOutfitIds.value = new Set(ids);
          }
        }
      } catch (e) {
        console.error("Failed to load selection from localStorage:", e);
      }
    };
    const isOutfitSelected = (itemId) => selectedForOutfitIds.value.has(itemId);
    const categoryKeywords = {
      Tops: ["t-shirt", "tee", "shirt", "blouse", "hoodie", "sweater", "cardigan", "tank", "camisole", "polo", "top"],
      Bottoms: ["jeans", "pants", "trousers", "shorts", "skirt", "leggings", "chinos", "culottes", "palazzo", "bottom"],
      Outerwear: ["jacket", "coat", "blazer", "windbreaker", "bomber", "parka", "poncho", "outerwear"],
      Dresses: ["dress", "gown", "sundress", "slip dress", "cheongsam", "qipao"],
      Shoes: ["shoe", "sneaker", "boot", "heel", "loafer", "sandal", "flat", "mule", "slipper", "cleat"],
      Accessories: ["belt", "hat", "scarf", "watch", "sunglasses", "bag", "purse", "jewelry", "bracelet", "necklace", "glove", "wallet"],
      Sportswear: ["jersey", "compression", "yoga", "active", "tracksuit", "swim", "athletic", "sports"],
      Traditional: ["hanfu", "kimono", "sari", "dirndl", "kebaya", "tuxedo", "suit", "uniform"]
    };
    const isLoadingItems = ref(false);
    const checkBackendHealth = async (maxRetries = 5, delay = 1e3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await apiClient.get("/health", {
            timeout: 5e3
          });
          if (response.data.status === "ready") {
            return true;
          }
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      return false;
    };
    const loadUserItems = async () => {
      var _a, _b, _c, _d, _e, _f, _g;
      isLoadingItems.value = true;
      try {
        const isReady = await checkBackendHealth();
        if (!isReady) {
          console.warn("Backend is still initializing, but attempting to load items anyway...");
        }
        const response = await apiClient.get("/items", {
          timeout: 3e4
          // 30 seconds timeout
        });
        if (!response.data || !response.data.items) {
          console.warn("Invalid response format:", response.data);
          uploadedItems.value = [];
          return;
        }
        uploadedItems.value = response.data.items.map((item) => ({
          id: item.id,
          url: item.path || item.url || "",
          features: {
            path: item.path || item.url || "",
            type: item.type || "Unknown",
            color: item.color || "Unknown",
            style: item.style || "Unknown",
            pattern: item.pattern,
            occasion: item.occasion,
            material: item.material
          }
        }));
        hasLoadedItems.value = true;
        saveItemsToCache();
        sessionStorage.removeItem("wardrobe_load_attempted");
        console.log("Loaded user items:", uploadedItems.value.length);
      } catch (error) {
        console.error("Failed to load user items:", error);
        let errorMessage = "Unknown error";
        if ((error == null ? void 0 : error.code) === "ERR_NETWORK" || ((_a = error == null ? void 0 : error.message) == null ? void 0 : _a.includes("Network Error")) || ((_b = error == null ? void 0 : error.message) == null ? void 0 : _b.includes("Connection"))) {
          errorMessage = `Cannot reach backend service. Please ensure ${API_URL} is running.`;
        } else if ((error == null ? void 0 : error.code) === "ECONNABORTED" || ((_c = error == null ? void 0 : error.message) == null ? void 0 : _c.includes("timeout"))) {
          errorMessage = "Request timed out; backend may still be initializing. Wait a moment and refresh.";
        } else if (((_d = error == null ? void 0 : error.response) == null ? void 0 : _d.status) === 401) {
          errorMessage = "Authentication failed. Please sign in again.";
        } else if (((_e = error == null ? void 0 : error.response) == null ? void 0 : _e.status) === 503) {
          errorMessage = "Backend is initializing; please wait a moment and refresh.";
        } else if ((_g = (_f = error == null ? void 0 : error.response) == null ? void 0 : _f.data) == null ? void 0 : _g.detail) {
          errorMessage = error.response.data.detail;
        } else if (error == null ? void 0 : error.message) {
          errorMessage = error.message;
        }
        alert(`Failed to load wardrobe data: ${errorMessage}

Check that the backend is running, or refresh and retry.`);
      } finally {
        isLoadingItems.value = false;
      }
    };
    const formatFeatureValue = (value) => {
      if (!value) return "Unknown";
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return value;
    };
    const getTypeCandidates = (typeValue) => {
      if (!typeValue) return [];
      if (Array.isArray(typeValue)) {
        return typeValue.map((t) => t.toLowerCase());
      }
      return [typeValue.toLowerCase()];
    };
    const matchesCategory = (typeValue, category) => {
      if (category === "All") return true;
      const candidates = getTypeCandidates(typeValue);
      if (candidates.length === 0) return false;
      const keywords = categoryKeywords[category] || [];
      return candidates.some((candidate) => keywords.some((keyword) => candidate.includes(keyword)));
    };
    const filteredItems = computed(() => {
      return uploadedItems.value.filter((item) => matchesCategory(item.features.type, selectedFilter.value));
    });
    const isSelectionMode = ref(false);
    const selectedItemIds = ref(/* @__PURE__ */ new Set());
    const isDeleting = ref(false);
    const selectedCount = computed(() => selectedItemIds.value.size);
    const isAllSelected = computed(() => {
      return filteredItems.value.length > 0 && selectedItemIds.value.size === filteredItems.value.length;
    });
    const showImageViewer = ref(false);
    const currentImageIndex = ref(0);
    const imageViewerImages = ref([]);
    const closeImageViewer = () => {
      showImageViewer.value = false;
      imageViewerImages.value = [];
      currentImageIndex.value = 0;
    };
    const nextImage = () => {
      if (currentImageIndex.value < imageViewerImages.value.length - 1) {
        currentImageIndex.value++;
      } else {
        currentImageIndex.value = 0;
      }
    };
    const prevImage = () => {
      if (currentImageIndex.value > 0) {
        currentImageIndex.value--;
      } else {
        currentImageIndex.value = imageViewerImages.value.length - 1;
      }
    };
    const handleKeyDown = (event) => {
      if (!showImageViewer.value) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevImage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextImage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeImageViewer();
      }
    };
    onMounted(() => {
      if (uploadedItems.value.length === 0) {
        restoreItemsFromCache();
      }
      loadOutfitSelection();
      window.addEventListener("keydown", handleKeyDown);
    });
    const saveItemsToCache = () => {
      try {
        sessionStorage.setItem("wardrobe_items_cache", JSON.stringify(uploadedItems.value));
      } catch (e) {
        console.warn("Failed to save items to sessionStorage:", e);
      }
    };
    const restoreItemsFromCache = () => {
      try {
        const cached = sessionStorage.getItem("wardrobe_items_cache");
        if (cached) {
          const items = JSON.parse(cached);
          if (Array.isArray(items) && items.length > 0) {
            uploadedItems.value = items;
            hasLoadedItems.value = true;
            console.log("[Wardrobe] Restored items from sessionStorage:", items.length);
            return true;
          }
        }
      } catch (e) {
        console.warn("Failed to restore items from sessionStorage:", e);
      }
      return false;
    };
    onActivated(() => {
      loadOutfitSelection();
      if (uploadedItems.value.length === 0) {
        const restored = restoreItemsFromCache();
        if (restored) {
          console.log("[Wardrobe onActivated] Restored items from sessionStorage, count:", uploadedItems.value.length);
        } else {
          const hasTriedLoading = sessionStorage.getItem("wardrobe_load_attempted") === "true";
          if (!hasTriedLoading && !hasLoadedItems.value) {
            console.log("[Wardrobe onActivated] No cached data, loading items...");
            sessionStorage.setItem("wardrobe_load_attempted", "true");
            loadUserItems();
          } else {
            console.log("[Wardrobe onActivated] Already attempted loading, skipping to avoid repeated failures");
          }
        }
      } else {
        console.log("[Wardrobe onActivated] Using cached data, items count:", uploadedItems.value.length);
      }
      console.log("[Wardrobe onActivated] Reloaded outfit selection from localStorage");
    });
    watch(() => route.name, (newName) => {
      if (newName === "wardrobe") {
        loadOutfitSelection();
        console.log("[Wardrobe watch route] Reloaded outfit selection from localStorage");
      }
    });
    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 font-sans text-gray-900" }, _attrs))}><header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-8 flex items-center justify-between"><h1 class="text-3xl font-bold tracking-tight">My Wardrobe</h1></header><main class="container mx-auto px-4 sm:px-6 lg:px-8 space-y-6"><section class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><h2 class="text-lg font-semibold mb-4 flex items-center gap-2">`);
      _push(ssrRenderComponent(unref(Upload), { class: "w-5 h-5" }, null, _parent));
      _push(` Add Wardrobe Items </h2><div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-black transition-colors cursor-pointer relative bg-gray-50 hover:bg-gray-100"><input type="file" class="hidden" accept="image/*" multiple>`);
      if (isUploading.value && uploadProgress.value) {
        _push(`<div class="flex flex-col items-center gap-2 pointer-events-none"><div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div><span class="text-sm text-gray-500"> Uploading ${ssrInterpolate(uploadProgress.value.current)}/${ssrInterpolate(uploadProgress.value.total)}</span><span class="text-xs text-gray-400">${ssrInterpolate(uploadProgress.value.currentFile)}</span></div>`);
      } else if (isUploading.value) {
        _push(`<div class="flex flex-col items-center gap-2 pointer-events-none"><div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div><span class="text-sm text-gray-500">Analyzing...</span></div>`);
      } else {
        _push(`<div class="pointer-events-none"><p class="font-medium text-gray-700">Click or drag to upload</p><p class="text-xs text-gray-400 mt-2">You can select multiple photos (JPG, PNG, WEBP, AVIF)</p></div>`);
      }
      _push(`</div><div class="mt-4 pt-4 border-t border-gray-200"><p class="text-sm font-medium text-gray-700 mb-2">Or add via URL</p><div class="flex gap-2"><input${ssrRenderAttr("value", imageUrlInput.value)} type="text" placeholder="Enter a public image URL (http:// or https://)" class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"${ssrIncludeBooleanAttr(isUploadingUrl.value || isUploading.value) ? " disabled" : ""}><button${ssrIncludeBooleanAttr(isUploadingUrl.value || isUploading.value || !imageUrlInput.value.trim()) ? " disabled" : ""} class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">`);
      if (isUploadingUrl.value) {
        _push(`<span>Uploading...</span>`);
      } else {
        _push(`<span>Upload</span>`);
      }
      if (isUploadingUrl.value) {
        _push(`<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button></div></div></section><section class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]"><div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold flex items-center gap-2">`);
      _push(ssrRenderComponent(unref(Shirt), { class: "w-5 h-5" }, null, _parent));
      _push(` My Wardrobe `);
      if (uploadedItems.value.length > 0) {
        _push(`<span class="text-sm font-normal text-gray-500 ml-2"> (${ssrInterpolate(uploadedItems.value.length)} items) </span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</h2><div class="flex items-center gap-2"><button${ssrIncludeBooleanAttr(isLoadingItems.value) ? " disabled" : ""} class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1" title="Refresh data">`);
      _push(ssrRenderComponent(unref(RefreshCw), {
        class: ["w-4 h-4", { "animate-spin": isLoadingItems.value }]
      }, null, _parent));
      _push(`<span>Refresh</span></button><button class="${ssrRenderClass([isSelectionMode.value ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-black", "px-3 py-1.5 text-sm rounded-lg border transition-colors"])}">${ssrInterpolate(isSelectionMode.value ? "Cancel selection" : "Bulk select")}</button>`);
      if (isSelectionMode.value && selectedCount.value > 0) {
        _push(`<button${ssrIncludeBooleanAttr(isDeleting.value) ? " disabled" : ""} class="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">`);
        _push(ssrRenderComponent(unref(Trash2), { class: "w-4 h-4" }, null, _parent));
        _push(`<span>Delete (${ssrInterpolate(selectedCount.value)})</span></button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
      if (isSelectionMode.value) {
        _push(`<div class="mb-4 flex items-center gap-2"><button class="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-black transition-colors">${ssrInterpolate(isAllSelected.value ? "Unselect all" : "Select all")}</button><span class="text-sm text-gray-500">Selected ${ssrInterpolate(selectedCount.value)} / ${ssrInterpolate(filteredItems.value.length)} items</span></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="flex flex-wrap gap-2 mb-4"><!--[-->`);
      ssrRenderList(typeFilters, (filter) => {
        _push(`<button class="${ssrRenderClass([selectedFilter.value === filter ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-black", "px-3 py-1 text-sm rounded-full border transition-colors"])}">${ssrInterpolate(filter)}</button>`);
      });
      _push(`<!--]--></div><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"><!--[-->`);
      ssrRenderList(filteredItems.value, (item, index) => {
        _push(`<div class="${ssrRenderClass([isSelectionMode.value && selectedItemIds.value.has(String(item.id)) ? "border-blue-500 border-2 ring-2 ring-blue-200" : "border-gray-200", "group relative rounded-xl overflow-hidden border aspect-[3/4] cursor-pointer transition-all hover:shadow-md"])}">`);
        if (isSelectionMode.value) {
          _push(`<div class="absolute top-2 left-2 z-10"><div class="${ssrRenderClass([selectedItemIds.value.has(String(item.id)) ? "bg-blue-500 border-blue-500" : "bg-white/90 border-gray-300", "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"])}">`);
          if (selectedItemIds.value.has(String(item.id))) {
            _push(`<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (item.url || item.features.path) {
          _push(`<img${ssrRenderAttr("src", item.url || item.features.path)} class="${ssrRenderClass([isSelectionMode.value && selectedItemIds.value.has(String(item.id)) ? "opacity-75" : "", "absolute inset-0 w-full h-full object-cover"])}" alt="Clothing item">`);
        } else {
          _push(`<div class="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400"><span class="text-xs">${ssrInterpolate(item.features.type)}</span></div>`);
        }
        _push(`<div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs translate-y-full group-hover:translate-y-0 transition-transform">${ssrInterpolate(formatFeatureValue(item.features.color))}</div>`);
        if (!isSelectionMode.value) {
          _push(`<button class="${ssrRenderClass([isOutfitSelected(String(item.id)) ? "bg-black text-white opacity-100 shadow-md" : "bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-black hover:bg-white", "absolute top-2 right-2 z-10 p-1 rounded-full transition-all duration-200"])}" title="Add to Outfit Generator">`);
          if (isOutfitSelected(String(item.id))) {
            _push(ssrRenderComponent(unref(CheckCircle), { class: "w-5 h-5 fill-current" }, null, _parent));
          } else {
            _push(`<div class="w-5 h-5 rounded-full border-2 border-current"></div>`);
          }
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      });
      _push(`<!--]-->`);
      if (filteredItems.value.length === 0) {
        _push(`<div class="col-span-full flex flex-col items-center justify-center text-gray-400 py-12">`);
        _push(ssrRenderComponent(unref(Shirt), { class: "w-12 h-12 mb-2 opacity-20" }, null, _parent));
        if (uploadedItems.value.length === 0) {
          _push(`<p class="text-sm">No items yet.</p>`);
        } else {
          _push(`<p class="text-sm">No items match the &quot;${ssrInterpolate(selectedFilter.value)}&quot; filter.</p>`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></section>`);
      if (showConfirmDialog.value) {
        _push(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"><div class="p-6 border-b border-gray-200"><h3 class="text-xl font-bold">Multiple Items Detected</h3><p class="text-sm text-gray-500 mt-1">Please review and select the items you want to add to your wardrobe.</p></div><div class="flex-1 overflow-y-auto p-6"><div class="space-y-4"><!--[-->`);
        ssrRenderList(pendingItems.value, (item, index) => {
          _push(`<div class="${ssrRenderClass([{ "bg-gray-50": item.selected }, "border border-gray-200 rounded-xl p-4 hover:border-black transition-colors"])}"><div class="flex items-start gap-4"><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(item.selected) ? ssrLooseContain(item.selected, null) : item.selected) ? " checked" : ""} class="mt-1 w-4 h-4 text-black border-gray-300 rounded focus:ring-black"><div class="flex-1"><div class="flex items-center gap-2 mb-2"><h4 class="font-semibold">${ssrInterpolate(formatFeatureValue(item.features.type))}</h4><span class="text-sm text-gray-500">${ssrInterpolate(formatFeatureValue(item.features.color))}</span></div><div class="grid grid-cols-2 gap-2 text-xs text-gray-600"><div><span class="font-medium">Style:</span> ${ssrInterpolate(formatFeatureValue(item.features.style))}</div><div><span class="font-medium">Occasion:</span> ${ssrInterpolate(formatFeatureValue(item.features.occasion))}</div><div><span class="font-medium">Pattern:</span> ${ssrInterpolate(formatFeatureValue(item.features.pattern))}</div><div><span class="font-medium">Material:</span> ${ssrInterpolate(formatFeatureValue(item.features.material))}</div></div></div>`);
          if (item.url) {
            _push(`<img${ssrRenderAttr("src", item.url)} class="w-16 h-16 object-cover rounded-lg" alt="Item preview">`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        });
        _push(`<!--]--></div></div><div class="p-6 border-t border-gray-200 flex justify-end gap-3"><button class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"> Cancel </button><button${ssrIncludeBooleanAttr(isConfirming.value) ? " disabled" : ""} class="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><span>${ssrInterpolate(isConfirming.value ? "Adding..." : `Add Selected (${pendingItems.value.filter((i) => i.selected).length})`)}</span>`);
        if (isConfirming.value) {
          _push(`<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</button></div>`);
        if (isConfirming.value) {
          _push(`<p class="text-sm text-gray-500 text-center pb-4"> Uploading items… hang tight, this may take a few seconds. </p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</main>`);
      if (showImageViewer.value && imageViewerImages.value.length > 0) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"><div class="relative w-full h-full flex items-center justify-center p-4"><button class="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
        _push(ssrRenderComponent(unref(X), { class: "w-6 h-6" }, null, _parent));
        _push(`</button>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronLeft), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="max-w-4xl max-h-[90vh] flex items-center justify-center"><img${ssrRenderAttr("src", imageViewerImages.value[currentImageIndex.value])} alt="Wardrobe item" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"></div>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronRight), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        if (imageViewerImages.value.length > 1) {
          _push(`<div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">${ssrInterpolate(currentImageIndex.value + 1)} / ${ssrInterpolate(imageViewerImages.value.length)}</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$9 = _sfc_main$9.setup;
_sfc_main$9.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Wardrobe.vue");
  return _sfc_setup$9 ? _sfc_setup$9(props, ctx) : void 0;
};
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  ...{ name: "LVProducts" },
  __name: "LVProducts",
  __ssrInlineRender: true,
  setup(__props) {
    const API_URL2 = "http://localhost:8000";
    const apiClient2 = axios.create({
      baseURL: API_URL2,
      headers: {
        "Content-Type": "application/json"
      }
    });
    apiClient2.interceptors.request.use(async (config) => {
      var _a;
      try {
        const { data } = await supabase.auth.getSession();
        const token = (_a = data.session) == null ? void 0 : _a.access_token;
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.warn("Failed to get Supabase session for request:", e);
      }
      return config;
    });
    const products = ref([]);
    const isLoading = ref(false);
    const searchKeyword = ref("");
    const totalProducts = ref(0);
    const currentPage = ref(1);
    const pageSize = ref(20);
    const showScrapeDialog = ref(false);
    const isScraping = ref(false);
    const scrapeCategoryUrl = ref("");
    const scrapeMaxPages = ref(1);
    const scrapeMaxProducts = ref(null);
    const generateThumbnails = ref(true);
    const watermarkText = ref("fashion-rec.dongzhouhe.com");
    const scrapeResult = ref(null);
    const loadProducts = async (page = 1) => {
      var _a, _b;
      isLoading.value = true;
      try {
        const offset = (page - 1) * pageSize.value;
        const response = await apiClient2.get("/lv-products", {
          params: {
            limit: pageSize.value,
            offset,
            order_by: "created_at",
            order_direction: "DESC"
          }
        });
        products.value = response.data.products;
        totalProducts.value = response.data.total;
        currentPage.value = page;
      } catch (error) {
        console.error("Failed to load products:", error);
        alert(`Failed to load products: ${((_b = (_a = error.response) == null ? void 0 : _a.data) == null ? void 0 : _b.detail) || error.message}`);
      } finally {
        isLoading.value = false;
      }
    };
    const totalPages = computed(() => {
      return Math.ceil(totalProducts.value / pageSize.value);
    });
    const formatPrice = (price) => {
      if (!price) return "Price unavailable";
      return price;
    };
    onMounted(() => {
      loadProducts();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 p-6" }, _attrs))} data-v-d5d41bef><div class="max-w-7xl mx-auto" data-v-d5d41bef><div class="mb-6 flex items-center justify-between" data-v-d5d41bef><div class="flex items-center gap-3" data-v-d5d41bef>`);
      _push(ssrRenderComponent(unref(ShoppingBag), { class: "w-8 h-8 text-purple-600" }, null, _parent));
      _push(`<h1 class="text-3xl font-bold text-gray-900" data-v-d5d41bef>LV Product Index</h1></div><button class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2" data-v-d5d41bef>`);
      _push(ssrRenderComponent(unref(Download), { class: "w-5 h-5" }, null, _parent));
      _push(` 抓取商品 </button></div><div class="mb-6 flex gap-3" data-v-d5d41bef><div class="flex-1 relative" data-v-d5d41bef>`);
      _push(ssrRenderComponent(unref(Search), { class: "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" }, null, _parent));
      _push(`<input${ssrRenderAttr("value", searchKeyword.value)} type="text" placeholder="Search product name..." class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" data-v-d5d41bef></div><button class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" data-v-d5d41bef> 搜索 </button>`);
      if (searchKeyword.value) {
        _push(`<button class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors" data-v-d5d41bef> 清除 </button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><div class="mb-4 text-sm text-gray-600" data-v-d5d41bef> Found ${ssrInterpolate(totalProducts.value)} product(s) </div>`);
      if (isLoading.value) {
        _push(`<div class="flex justify-center items-center py-12" data-v-d5d41bef>`);
        _push(ssrRenderComponent(unref(Loader2), { class: "w-8 h-8 text-purple-600 animate-spin" }, null, _parent));
        _push(`<span class="ml-3 text-gray-600" data-v-d5d41bef>加载中...</span></div>`);
      } else if (products.value.length > 0) {
        _push(`<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" data-v-d5d41bef><!--[-->`);
        ssrRenderList(products.value, (product) => {
          _push(`<div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group" data-v-d5d41bef><div class="relative aspect-square bg-gray-100 overflow-hidden" data-v-d5d41bef><img${ssrRenderAttr("src", product.thumbnail_url || product.original_image_url)}${ssrRenderAttr("alt", product.product_name)} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" data-v-d5d41bef><div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" data-v-d5d41bef>`);
          if (!product.thumbnail_url) {
            _push(`<button class="p-2 bg-white rounded-full shadow-md hover:bg-gray-50" title="生成缩略图" data-v-d5d41bef>`);
            _push(ssrRenderComponent(unref(Download), { class: "w-4 h-4 text-purple-600" }, null, _parent));
            _push(`</button>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div><div class="p-4" data-v-d5d41bef><h3 class="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3rem]" data-v-d5d41bef>${ssrInterpolate(product.product_name)}</h3><p class="text-purple-600 font-bold mb-3" data-v-d5d41bef>${ssrInterpolate(formatPrice(product.price))}</p><div class="flex gap-2" data-v-d5d41bef><a${ssrRenderAttr("href", product.original_lv_url)} target="_blank" rel="noopener noreferrer" class="flex-1 px-3 py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2" data-v-d5d41bef>`);
          _push(ssrRenderComponent(unref(ExternalLink), { class: "w-4 h-4" }, null, _parent));
          _push(` 查看详情 </a></div><div class="mt-2 text-xs text-gray-500" data-v-d5d41bef>${ssrInterpolate(new Date(product.created_at).toLocaleDateString("zh-CN"))}</div></div></div>`);
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<div class="text-center py-12" data-v-d5d41bef>`);
        _push(ssrRenderComponent(unref(ShoppingBag), { class: "w-16 h-16 text-gray-400 mx-auto mb-4" }, null, _parent));
        _push(`<p class="text-gray-600" data-v-d5d41bef>暂无商品</p><button class="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" data-v-d5d41bef> 开始抓取商品 </button></div>`);
      }
      if (totalPages.value > 1) {
        _push(`<div class="mt-8 flex justify-center gap-2" data-v-d5d41bef><button${ssrIncludeBooleanAttr(currentPage.value === 1) ? " disabled" : ""} class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" data-v-d5d41bef> 上一页 </button><span class="px-4 py-2 text-gray-700" data-v-d5d41bef> 第 ${ssrInterpolate(currentPage.value)} / ${ssrInterpolate(totalPages.value)} 页 </span><button${ssrIncludeBooleanAttr(currentPage.value === totalPages.value) ? " disabled" : ""} class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" data-v-d5d41bef> 下一页 </button></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showScrapeDialog.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-v-d5d41bef><div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" data-v-d5d41bef><h2 class="text-2xl font-bold text-gray-900 mb-4" data-v-d5d41bef>抓取LV商品</h2><div class="space-y-4" data-v-d5d41bef><div data-v-d5d41bef><label class="block text-sm font-medium text-gray-700 mb-1" data-v-d5d41bef> 商品分类页面URL * </label><input${ssrRenderAttr("value", scrapeCategoryUrl.value)} type="text" placeholder="例如: https://www.louisvuitton.com/zhs-cn/catalog/women/handbags" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" data-v-d5d41bef><p class="mt-1 text-xs text-gray-500" data-v-d5d41bef> 输入LV官网的商品分类页面URL（需要根据实际网站结构调整） </p></div><div class="grid grid-cols-2 gap-4" data-v-d5d41bef><div data-v-d5d41bef><label class="block text-sm font-medium text-gray-700 mb-1" data-v-d5d41bef> 最大抓取页数 </label><input${ssrRenderAttr("value", scrapeMaxPages.value)} type="number" min="1" max="10" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" data-v-d5d41bef></div><div data-v-d5d41bef><label class="block text-sm font-medium text-gray-700 mb-1" data-v-d5d41bef> 最大商品数量（可选） </label><input${ssrRenderAttr("value", scrapeMaxProducts.value)} type="number" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="不限制" data-v-d5d41bef></div></div><div data-v-d5d41bef><label class="flex items-center gap-2" data-v-d5d41bef><input${ssrIncludeBooleanAttr(Array.isArray(generateThumbnails.value) ? ssrLooseContain(generateThumbnails.value, null) : generateThumbnails.value) ? " checked" : ""} type="checkbox" class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" data-v-d5d41bef><span class="text-sm font-medium text-gray-700" data-v-d5d41bef>自动生成缩略图</span></label></div>`);
        if (generateThumbnails.value) {
          _push(`<div data-v-d5d41bef><label class="block text-sm font-medium text-gray-700 mb-1" data-v-d5d41bef> 水印文字 </label><input${ssrRenderAttr("value", watermarkText.value)} type="text" placeholder="fashion-rec.dongzhouhe.com" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" data-v-d5d41bef></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex gap-3 pt-4" data-v-d5d41bef><button${ssrIncludeBooleanAttr(isScraping.value || !scrapeCategoryUrl.value.trim()) ? " disabled" : ""} class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" data-v-d5d41bef>`);
        if (isScraping.value) {
          _push(ssrRenderComponent(unref(Loader2), { class: "w-5 h-5 animate-spin" }, null, _parent));
        } else {
          _push(ssrRenderComponent(unref(Download), { class: "w-5 h-5" }, null, _parent));
        }
        _push(` ${ssrInterpolate(isScraping.value ? "抓取中..." : "开始抓取")}</button><button${ssrIncludeBooleanAttr(isScraping.value) ? " disabled" : ""} class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50" data-v-d5d41bef> 取消 </button></div>`);
        if (scrapeResult.value) {
          _push(`<div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg" data-v-d5d41bef><p class="text-sm text-green-800" data-v-d5d41bef> 成功抓取 ${ssrInterpolate(scrapeResult.value.total_added)} 个商品（共抓取 ${ssrInterpolate(scrapeResult.value.total_scraped)} 个） </p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _sfc_setup$8 = _sfc_main$8.setup;
_sfc_main$8.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/LVProducts.vue");
  return _sfc_setup$8 ? _sfc_setup$8(props, ctx) : void 0;
};
const LVProducts = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-d5d41bef"]]);
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  ...{ name: "Favorites" },
  __name: "Favorites",
  __ssrInlineRender: true,
  setup(__props) {
    useRouter();
    const authStore = useAuthStore();
    onActivated(async () => {
      try {
        await authStore.refreshSession();
      } catch (e) {
        console.warn("[Favorites] Failed to refresh session on activated:", e);
      }
    });
    const favorites = ref([]);
    const isLoading = ref(false);
    const error = ref("");
    const showImageViewer = ref(false);
    const currentImageIndex = ref(0);
    const imageViewerImages = ref([]);
    const saveFavoritesToCache = () => {
      try {
        sessionStorage.setItem("favorites_cache", JSON.stringify(favorites.value));
      } catch (e) {
        console.warn("[Favorites] Failed to save favorites to cache:", e);
      }
    };
    const restoreFavoritesFromCache = () => {
      try {
        const cached = sessionStorage.getItem("favorites_cache");
        if (cached) {
          const items = JSON.parse(cached);
          if (Array.isArray(items) && items.length > 0) {
            favorites.value = items;
            console.log("[Favorites] Restored favorites from cache:", items.length, "items");
            return true;
          }
        }
      } catch (e) {
        console.warn("[Favorites] Failed to restore favorites from cache:", e);
      }
      return false;
    };
    const loadFavorites = async () => {
      var _a, _b, _c;
      if (isLoading.value) {
        return;
      }
      isLoading.value = true;
      error.value = "";
      try {
        const response = await apiClient.get("/favorites");
        favorites.value = response.data.favorites || [];
        saveFavoritesToCache();
      } catch (e) {
        console.error("Failed to load favorites:", e);
        const errorDetail = ((_b = (_a = e == null ? void 0 : e.response) == null ? void 0 : _a.data) == null ? void 0 : _b.detail) || (e == null ? void 0 : e.message) || "Failed to load favorites";
        if (((_c = e == null ? void 0 : e.response) == null ? void 0 : _c.status) === 401 || errorDetail.includes("Not authenticated") || errorDetail.includes("authenticated")) {
          if (favorites.value.length > 0) {
            console.log("[Favorites] API failed but using cached data");
            error.value = "";
            return;
          }
        }
        if (favorites.value.length === 0) {
          error.value = errorDetail;
        } else {
          console.log("[Favorites] API failed but using cached data, hiding error");
          error.value = "";
        }
      } finally {
        isLoading.value = false;
      }
    };
    const closeImageViewer = () => {
      showImageViewer.value = false;
      imageViewerImages.value = [];
      currentImageIndex.value = 0;
    };
    const nextImage = () => {
      if (currentImageIndex.value < imageViewerImages.value.length - 1) {
        currentImageIndex.value++;
      } else {
        currentImageIndex.value = 0;
      }
    };
    const prevImage = () => {
      if (currentImageIndex.value > 0) {
        currentImageIndex.value--;
      } else {
        currentImageIndex.value = imageViewerImages.value.length - 1;
      }
    };
    const handleKeyDown = (event) => {
      if (!showImageViewer.value) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevImage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextImage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeImageViewer();
      }
    };
    onMounted(async () => {
      restoreFavoritesFromCache();
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await loadFavorites();
        } else {
          console.warn("[Favorites] No session found on mount, but still attempting to load data");
          await loadFavorites();
        }
      } catch (error2) {
        console.error("[Favorites] Failed to check session on mount:", error2);
        await loadFavorites();
      }
      window.addEventListener("keydown", handleKeyDown);
    });
    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString);
        const now = /* @__PURE__ */ new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
        if (diffDays === 0) {
          const diffHours = Math.floor(diffMs / (1e3 * 60 * 60));
          if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1e3 * 60));
            return diffMinutes <= 1 ? "just now" : `${diffMinutes} minutes ago`;
          }
          return `${diffHours} hours ago`;
        } else if (diffDays === 1) {
          return "yesterday";
        } else if (diffDays < 7) {
          return `${diffDays} days ago`;
        } else {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      } catch {
        return dateString;
      }
    };
    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 font-sans text-gray-900" }, _attrs))}><header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between"><h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">`);
      _push(ssrRenderComponent(unref(Heart), { class: "w-6 h-6 text-red-500 fill-current" }, null, _parent));
      _push(` My Favorites </h1></header><main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">`);
      if (isLoading.value) {
        _push(`<div class="py-12 flex flex-col items-center justify-center"><div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-gray-500">Loading favorites...</p></div>`);
      } else if (error.value) {
        _push(`<div class="py-8 text-center text-red-600 text-sm">${ssrInterpolate(error.value)}</div>`);
      } else if (!favorites.value.length) {
        _push(`<div class="py-12 text-center">`);
        _push(ssrRenderComponent(unref(Heart), { class: "w-16 h-16 mx-auto mb-4 text-gray-300" }, null, _parent));
        _push(`<p class="text-gray-500 text-sm mb-2">No try-on results saved yet</p><p class="text-gray-400 text-xs">After you try on looks, tap Favorite to save what you like.</p></div>`);
      } else {
        _push(`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"><!--[-->`);
        ssrRenderList(favorites.value, (favorite, index) => {
          _push(`<div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"><div class="aspect-square bg-gray-100 cursor-pointer overflow-hidden relative"><img${ssrRenderAttr("src", favorite.image_url)}${ssrRenderAttr("alt", favorite.title || "Favorite")} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div></div><div class="p-4"><div class="flex items-start justify-between gap-2 mb-2"><div class="flex-1"><p class="text-xs text-gray-400 mb-1">${ssrInterpolate(formatDate(favorite.created_at))}</p>`);
          if (favorite.garment_urls && favorite.garment_urls.length > 0) {
            _push(`<p class="text-xs text-gray-500">${ssrInterpolate(favorite.garment_urls.length)} item(s) </p>`);
          } else {
            _push(`<!---->`);
          }
          if (favorite.scene_image_url) {
            _push(`<p class="text-xs text-blue-500 mt-1"> 包含场景 </p>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><div class="flex items-center gap-1"><button class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center transition-colors group" title="恢复到此试穿">`);
          _push(ssrRenderComponent(unref(RotateCcw), { class: "w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" }, null, _parent));
          _push(`</button><button class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group" title="删除收藏">`);
          _push(ssrRenderComponent(unref(X), { class: "w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" }, null, _parent));
          _push(`</button></div></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      }
      _push(`</main>`);
      if (showImageViewer.value && imageViewerImages.value.length > 0) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"><div class="relative w-full h-full flex items-center justify-center p-4"><button class="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
        _push(ssrRenderComponent(unref(X), { class: "w-6 h-6" }, null, _parent));
        _push(`</button>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronLeft), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="max-w-4xl max-h-[90vh] flex items-center justify-center"><img${ssrRenderAttr("src", imageViewerImages.value[currentImageIndex.value])} alt="Favorite" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"></div>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronRight), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        if (imageViewerImages.value.length > 1) {
          _push(`<div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">${ssrInterpolate(currentImageIndex.value + 1)} / ${ssrInterpolate(imageViewerImages.value.length)}</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$7 = _sfc_main$7.setup;
_sfc_main$7.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Favorites.vue");
  return _sfc_setup$7 ? _sfc_setup$7(props, ctx) : void 0;
};
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  ...{ name: "TryOnHistory" },
  __name: "TryOnHistory",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const authStore = useAuthStore();
    onActivated(async () => {
      try {
        await authStore.refreshSession();
      } catch (e) {
        console.warn("[TryOnHistory] Failed to refresh session on activated:", e);
      }
    });
    const historyItems = ref([]);
    const isLoading = ref(false);
    const error = ref("");
    const showImageViewer = ref(false);
    const currentImageIndex = ref(0);
    const imageViewerImages = ref([]);
    const saveHistoryToCache = () => {
      try {
        sessionStorage.setItem("tryon_history_cache", JSON.stringify(historyItems.value));
      } catch (e) {
        console.warn("[TryOnHistory] Failed to save history to cache:", e);
      }
    };
    const restoreHistoryFromCache = () => {
      try {
        const cached = sessionStorage.getItem("tryon_history_cache");
        if (cached) {
          const items = JSON.parse(cached);
          if (Array.isArray(items) && items.length > 0) {
            historyItems.value = items;
            console.log("[TryOnHistory] Restored history from cache:", items.length, "items");
            return true;
          }
        }
      } catch (e) {
        console.warn("[TryOnHistory] Failed to restore history from cache:", e);
      }
      return false;
    };
    const loadHistory = async () => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      if (isLoading.value) {
        return;
      }
      fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:151", message: "loadHistory entry", data: { localStorageToken: ((_a = localStorage.getItem("auth_token")) == null ? void 0 : _a.substring(0, 20)) || null }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
      });
      isLoading.value = true;
      error.value = "";
      try {
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:161", message: "About to call apiClient.get", data: { localStorageToken: ((_b = localStorage.getItem("auth_token")) == null ? void 0 : _b.substring(0, 20)) || null }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
        });
        const response = await apiClient.get("/tryon-history");
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:162", message: "loadHistory success", data: { historyCount: ((_c = response.data.history) == null ? void 0 : _c.length) || 0 }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
        });
        historyItems.value = response.data.history || [];
        saveHistoryToCache();
      } catch (e) {
        console.error("Failed to load try-on history:", e);
        const errorDetail = ((_e = (_d = e == null ? void 0 : e.response) == null ? void 0 : _d.data) == null ? void 0 : _e.detail) || (e == null ? void 0 : e.message) || "Failed to load try-on history";
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:166", message: "loadHistory error", data: { status: (_f = e == null ? void 0 : e.response) == null ? void 0 : _f.status, errorDetail, hasAuthHeader: !!((_h = (_g = e == null ? void 0 : e.config) == null ? void 0 : _g.headers) == null ? void 0 : _h.Authorization) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "A,B,C" }) }).catch(() => {
        });
        if (((_i = e == null ? void 0 : e.response) == null ? void 0 : _i.status) === 401 || errorDetail.includes("Not authenticated") || errorDetail.includes("authenticated")) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            if (historyItems.value.length === 0) {
              router.push("/login");
              return;
            }
          }
        }
        if (historyItems.value.length === 0) {
          error.value = errorDetail;
        } else {
          console.log("[TryOnHistory] API failed but using cached data, hiding error");
          error.value = "";
        }
      } finally {
        isLoading.value = false;
      }
    };
    const closeImageViewer = () => {
      showImageViewer.value = false;
      imageViewerImages.value = [];
      currentImageIndex.value = 0;
    };
    const nextImage = () => {
      if (currentImageIndex.value < imageViewerImages.value.length - 1) {
        currentImageIndex.value++;
      } else {
        currentImageIndex.value = 0;
      }
    };
    const prevImage = () => {
      if (currentImageIndex.value > 0) {
        currentImageIndex.value--;
      } else {
        currentImageIndex.value = imageViewerImages.value.length - 1;
      }
    };
    const handleKeyDown = (event) => {
      if (!showImageViewer.value) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevImage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextImage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeImageViewer();
      }
    };
    onMounted(async () => {
      var _a, _b, _c;
      fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:257", message: "onMounted entry", data: { localStorageToken: ((_a = localStorage.getItem("auth_token")) == null ? void 0 : _a.substring(0, 20)) || null }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
      });
      restoreHistoryFromCache();
      try {
        const { data } = await supabase.auth.getSession();
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:263", message: "onMounted getSession result", data: { hasSession: !!data.session, hasToken: !!((_b = data.session) == null ? void 0 : _b.access_token), localStorageToken: ((_c = localStorage.getItem("auth_token")) == null ? void 0 : _c.substring(0, 20)) || null }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
        });
        if (data.session) {
          fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:266", message: "Calling loadHistory (has session)", data: {}, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
          });
          await loadHistory();
        } else {
          console.warn("[TryOnHistory] No session found on mount, but still attempting to load data");
          fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:269", message: "Calling loadHistory (no session)", data: {}, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
          });
          await loadHistory();
        }
      } catch (error2) {
        console.error("[TryOnHistory] Failed to check session on mount:", error2);
        fetch("http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "TryOnHistory.vue:273", message: "Calling loadHistory (error)", data: { error: String(error2) }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "D" }) }).catch(() => {
        });
        await loadHistory();
      }
      window.addEventListener("keydown", handleKeyDown);
    });
    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString);
        const now = /* @__PURE__ */ new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
        if (diffDays === 0) {
          const diffHours = Math.floor(diffMs / (1e3 * 60 * 60));
          if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1e3 * 60));
            return diffMinutes <= 1 ? "just now" : `${diffMinutes} minutes ago`;
          }
          return `${diffHours} hours ago`;
        } else if (diffDays === 1) {
          return "yesterday";
        } else if (diffDays < 7) {
          return `${diffDays} days ago`;
        } else {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      } catch {
        return dateString;
      }
    };
    const getDaysRemaining = (expiresAt) => {
      try {
        const expiresDate = new Date(expiresAt);
        const now = /* @__PURE__ */ new Date();
        const diffMs = expiresDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1e3 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
      } catch {
        return 0;
      }
    };
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 font-sans text-gray-900" }, _attrs))}><header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between"><div class="flex items-center gap-3"><h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">`);
      _push(ssrRenderComponent(unref(History), { class: "w-6 h-6 text-blue-500" }, null, _parent));
      _push(` Try-On History </h1></div></header><main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">`);
      if (isLoading.value) {
        _push(`<div class="py-12 flex flex-col items-center justify-center"><div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-gray-500">Loading try-on history...</p></div>`);
      } else if (error.value) {
        _push(`<div class="py-8 text-center text-red-600 text-sm">${ssrInterpolate(error.value)}</div>`);
      } else if (!historyItems.value.length) {
        _push(`<div class="py-12 text-center">`);
        _push(ssrRenderComponent(unref(History), { class: "w-16 h-16 mx-auto mb-4 text-gray-300" }, null, _parent));
        _push(`<p class="text-gray-500 text-sm mb-2">No try-on history yet</p><p class="text-gray-400 text-xs">After you try on looks, results will be saved here automatically.</p></div>`);
      } else {
        _push(`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"><!--[-->`);
        ssrRenderList(historyItems.value, (item, index) => {
          _push(`<div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"><div class="aspect-square bg-gray-100 cursor-pointer overflow-hidden relative"><img${ssrRenderAttr("src", item.image_url)} alt="Try-on result" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div><div class="absolute top-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm"> Expires in ${ssrInterpolate(getDaysRemaining(item.expires_at))} days </div></div><div class="p-4"><div class="flex items-start justify-between gap-2 mb-2"><div class="flex-1"><p class="text-xs text-gray-400 mb-1">${ssrInterpolate(formatDate(item.created_at))}</p>`);
          if (item.garment_urls && item.garment_urls.length > 0) {
            _push(`<p class="text-xs text-gray-500">${ssrInterpolate(item.garment_urls.length)} item(s) </p>`);
          } else {
            _push(`<!---->`);
          }
          if (item.scene_image_url) {
            _push(`<p class="text-xs text-blue-500 mt-1"> Includes scene </p>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><div class="flex items-center gap-1"><button class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center transition-colors group" title="Restore to this fitting">`);
          _push(ssrRenderComponent(unref(RotateCcw), { class: "w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" }, null, _parent));
          _push(`</button><button class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group" title="Clear History">`);
          _push(ssrRenderComponent(unref(X), { class: "w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" }, null, _parent));
          _push(`</button></div></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      }
      _push(`</main>`);
      if (showImageViewer.value && imageViewerImages.value.length > 0) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"><div class="relative w-full h-full flex items-center justify-center p-4"><button class="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
        _push(ssrRenderComponent(unref(X), { class: "w-6 h-6" }, null, _parent));
        _push(`</button>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronLeft), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="max-w-4xl max-h-[90vh] flex items-center justify-center"><img${ssrRenderAttr("src", imageViewerImages.value[currentImageIndex.value])} alt="Try-on result" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"></div>`);
        if (imageViewerImages.value.length > 1) {
          _push(`<button class="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">`);
          _push(ssrRenderComponent(unref(ChevronRight), { class: "w-6 h-6" }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        if (imageViewerImages.value.length > 1) {
          _push(`<div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">${ssrInterpolate(currentImageIndex.value + 1)} / ${ssrInterpolate(imageViewerImages.value.length)}</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/TryOnHistory.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  ...{ name: "PrivacyPolicy" },
  __name: "PrivacyPolicy",
  __ssrInlineRender: true,
  setup(__props) {
    useRouter();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 py-8 px-4" }, _attrs))} data-v-ec4c63b7><div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8" data-v-ec4c63b7><div class="mb-6" data-v-ec4c63b7><button class="flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-4" data-v-ec4c63b7>`);
      _push(ssrRenderComponent(unref(ArrowLeft), { class: "w-5 h-5" }, null, _parent));
      _push(`<span data-v-ec4c63b7>Back</span></button><h1 class="text-3xl font-bold mb-2" data-v-ec4c63b7>Privacy Policy</h1><p class="text-gray-500 text-sm" data-v-ec4c63b7>Last updated: Dec 16, 2025</p></div><div class="prose prose-sm max-w-none space-y-6 text-gray-700" data-v-ec4c63b7><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>1. Information We Collect</h2><p class="mb-3" data-v-ec4c63b7>We collect information to provide and improve our services:</p><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7><strong data-v-ec4c63b7>Account info:</strong> Email and password (hashed) when you sign up.</li><li data-v-ec4c63b7><strong data-v-ec4c63b7>Uploaded images:</strong> Garment and try-on photos to power recommendations and virtual try-on.</li><li data-v-ec4c63b7><strong data-v-ec4c63b7>Usage data:</strong> Preferences, favorites, browsing, and interaction history.</li><li data-v-ec4c63b7><strong data-v-ec4c63b7>Device info:</strong> Device type, OS, and browser to optimize experience.</li></ul></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>2. How We Use Information</h2><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7>Provide, maintain, and improve AI recommendations and virtual try-on.</li><li data-v-ec4c63b7>Process your requests and transactions.</li><li data-v-ec4c63b7>Send service notifications and updates.</li><li data-v-ec4c63b7>Analyze usage to improve user experience.</li><li data-v-ec4c63b7>Protect security and prevent fraud.</li></ul></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>3. Storage and Security</h2><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7>Encrypted transport (HTTPS).</li><li data-v-ec4c63b7>Passwords stored with secure hashing.</li><li data-v-ec4c63b7>Regular security reviews and scans.</li><li data-v-ec4c63b7>Restricted employee access to personal data.</li></ul><p class="mb-3" data-v-ec4c63b7>Data is stored on secure servers. We do not sell your personal information.</p></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>4. Sharing</h2><p class="mb-3" data-v-ec4c63b7>We do not sell or trade your personal data. We may share only when:</p><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7>You provide explicit consent.</li><li data-v-ec4c63b7>Required by law.</li><li data-v-ec4c63b7>Necessary to protect rights, property, or safety of users or the public.</li><li data-v-ec4c63b7>With service providers under strict confidentiality.</li></ul></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>5. AI Usage</h2><p class="mb-3" data-v-ec4c63b7>We use AI (including Qwen and related models) to power recommendations and virtual try-on. Image data may be used to:</p><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7>Train/optimize models in anonymized, aggregated form.</li><li data-v-ec4c63b7>Generate personalized outfit suggestions.</li><li data-v-ec4c63b7>Create virtual try-on results.</li></ul><p class="mb-3" data-v-ec4c63b7>We do not link personal identifiers to AI training data.</p></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>6. Cookies &amp; Tracking</h2><p class="mb-3" data-v-ec4c63b7>We use cookies to remember login state, save preferences, and analyze usage. You can manage cookies in your browser; disabling may affect features.</p></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>7. Your Rights</h2><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7>Access your personal data.</li><li data-v-ec4c63b7>Correct or update your data.</li><li data-v-ec4c63b7>Request deletion of your account and data.</li><li data-v-ec4c63b7>Data portability in a structured format.</li><li data-v-ec4c63b7>Withdraw consent at any time.</li></ul><p class="mb-3" data-v-ec4c63b7>Contact us to exercise these rights.</p></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>8. Data Retention</h2><ul class="list-disc pl-6 space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7>Account data retained while your account is active.</li><li data-v-ec4c63b7>Uploaded images retained until you delete them or your account.</li><li data-v-ec4c63b7>Legally required data retained as mandated.</li></ul></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>9. Children</h2><p class="mb-3" data-v-ec4c63b7>Our services are not directed to children under 13. If we learn we collected such data, we will delete it promptly.</p></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>10. Changes</h2><p class="mb-3" data-v-ec4c63b7>We may update this policy. Significant changes will be communicated via email or site notice. Continued use means acceptance of updates.</p></section><section data-v-ec4c63b7><h2 class="text-xl font-semibold mb-3 text-black" data-v-ec4c63b7>11. Contact Us</h2><p class="mb-3" data-v-ec4c63b7>Questions? Contact us:</p><ul class="list-none space-y-2 mb-3" data-v-ec4c63b7><li data-v-ec4c63b7><strong data-v-ec4c63b7>Email:</strong>support@hdz73.com</li></ul></section></div><div class="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500" data-v-ec4c63b7><p data-v-ec4c63b7>© 2025 Fashion Rec. All rights reserved.</p></div></div></div>`);
    };
  }
});
const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/PrivacyPolicy.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const PrivacyPolicy = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-ec4c63b7"]]);
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  ...{ name: "TermsOfService" },
  __name: "TermsOfService",
  __ssrInlineRender: true,
  setup(__props) {
    useRouter();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 py-8 px-4" }, _attrs))} data-v-dce8ee6d><div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8" data-v-dce8ee6d><div class="mb-6" data-v-dce8ee6d><button class="flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-4" data-v-dce8ee6d>`);
      _push(ssrRenderComponent(unref(ArrowLeft), { class: "w-5 h-5" }, null, _parent));
      _push(`<span data-v-dce8ee6d>Back</span></button><h1 class="text-3xl font-bold mb-2" data-v-dce8ee6d>Terms of Service</h1><p class="text-gray-500 text-sm" data-v-dce8ee6d>Last updated: Dec 16, 2025</p></div><div class="prose prose-sm max-w-none space-y-6 text-gray-700" data-v-dce8ee6d><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>1. Acceptance</h2><p class="mb-3" data-v-dce8ee6d>By using Fashion Rec, you agree to these Terms. If you disagree, please do not use the service.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>2. Service Description</h2><p class="mb-3" data-v-dce8ee6d>Fashion Rec provides AI-powered outfit recommendations, virtual try-on, wardrobe management, and favorites/history features. We may modify, suspend, or discontinue services at any time.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>3. Accounts</h2><ul class="list-disc pl-6 space-y-2 mb-3" data-v-dce8ee6d><li data-v-dce8ee6d>Provide accurate and current registration info.</li><li data-v-dce8ee6d>Maintain and update your account details.</li><li data-v-dce8ee6d>Be responsible for all activity under your account.</li><li data-v-dce8ee6d>Notify us of unauthorized use.</li><li data-v-dce8ee6d>Keep your password confidential.</li></ul></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>4. User Content</h2><p class="mb-3" data-v-dce8ee6d>You own content you upload. You grant us rights to use, store, process, and display it to provide the service, and to improve AI models in anonymized/aggregated form.</p><ul class="list-disc pl-6 space-y-2 mb-3" data-v-dce8ee6d><li data-v-dce8ee6d>You have the necessary rights to the content.</li><li data-v-dce8ee6d>Your content does not infringe others’ rights.</li><li data-v-dce8ee6d>Your content is not illegal, harmful, or abusive.</li></ul></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>5. Prohibited Use</h2><p class="mb-3" data-v-dce8ee6d>You will not use the service to:</p><ul class="list-disc pl-6 space-y-2 mb-3" data-v-dce8ee6d><li data-v-dce8ee6d>Violate laws or regulations.</li><li data-v-dce8ee6d>Upload malware or harmful code.</li><li data-v-dce8ee6d>Attempt unauthorized access to systems.</li><li data-v-dce8ee6d>Disrupt or interfere with the service.</li><li data-v-dce8ee6d>Harvest information about users.</li><li data-v-dce8ee6d>Impersonate others.</li><li data-v-dce8ee6d>Engage in actions that may harm the service.</li></ul></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>6. AI-Generated Content</h2><ul class="list-disc pl-6 space-y-2 mb-3" data-v-dce8ee6d><li data-v-dce8ee6d>AI outputs may not be fully accurate or meet expectations.</li><li data-v-dce8ee6d>Virtual try-on is for reference and may differ from real-world results.</li><li data-v-dce8ee6d>No guarantees on accuracy, completeness, or suitability of AI outputs.</li><li data-v-dce8ee6d>Use your own judgment when relying on AI suggestions.</li></ul></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>7. Intellectual Property</h2><p class="mb-3" data-v-dce8ee6d>All service content (text, graphics, logos, images, software, etc.) belongs to us or licensors and is protected by IP laws. Do not copy, modify, distribute, sell, or rent without written permission.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>8. Disclaimer</h2><p class="mb-3" data-v-dce8ee6d>The service is provided “as is” and “as available.” We disclaim warranties to the fullest extent permitted by law, including accuracy, reliability, availability, or fitness for a particular purpose.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>9. Limitation of Liability</h2><p class="mb-3" data-v-dce8ee6d>To the maximum extent allowed, we are not liable for indirect, incidental, special, consequential, or punitive damages (including lost profits, data loss, business interruption), even if advised of the possibility.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>10. Indemnity</h2><p class="mb-3" data-v-dce8ee6d>You agree to indemnify and hold us harmless from claims arising from your use, violation of these Terms, infringement of third-party rights, or content you upload.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>11. Termination</h2><p class="mb-3" data-v-dce8ee6d>We may suspend or terminate accounts and access at any time (e.g., Terms violations, inactivity, legal requirements). Upon termination, access stops and we may delete your account/data.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>12. Changes</h2><p class="mb-3" data-v-dce8ee6d>We may update these Terms. Significant changes will be communicated via email or site notice. Continued use means acceptance of updated Terms.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>13. Governing Law</h2><p class="mb-3" data-v-dce8ee6d>These Terms are governed by applicable law. Disputes will be resolved through good-faith negotiation; if unresolved, they may be brought to a court of competent jurisdiction.</p></section><section data-v-dce8ee6d><h2 class="text-xl font-semibold mb-3 text-black" data-v-dce8ee6d>14. Contact</h2><p class="mb-3" data-v-dce8ee6d>Questions? Contact us:</p><ul class="list-none space-y-2 mb-3" data-v-dce8ee6d><li data-v-dce8ee6d><strong data-v-dce8ee6d>Email:</strong>support@hdz73.com</li></ul></section></div><div class="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500" data-v-dce8ee6d><p data-v-dce8ee6d>© 2025 Fashion Rec. All rights reserved.</p></div></div></div>`);
    };
  }
});
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/TermsOfService.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const TermsOfService = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-dce8ee6d"]]);
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  ...{ name: "Pricing" },
  __name: "Pricing",
  __ssrInlineRender: true,
  setup(__props) {
    useRouter();
    const API_URL2 = "http://localhost:8000";
    const SUBSCRIPTION_API_URL2 = "http://localhost:3001";
    const isLoading = ref(false);
    const error = ref(null);
    const subscriptionInfo = ref(null);
    const isTestMode = ref(false);
    const productIds = ref(null);
    const loadConfig = async () => {
      try {
        const response = await subscriptionClient2.get("/config");
        isTestMode.value = response.data.isTestMode;
        productIds.value = response.data.productIds;
        console.log("Environment config loaded:", { isTestMode: isTestMode.value, productIds: productIds.value });
      } catch (error2) {
        console.error("Failed to load config from backend, using fallback:", error2);
        isTestMode.value = true;
        productIds.value = {
          premium: {
            test: "prod_1W4roSJevbLIRwQyb3a8SQ",
            prod: "prod_ZcR2OsakU427r5LppdXpe"
          },
          premiumPlus: {
            test: "prod_6YsIDqxb9lnMmVarSuUfBc",
            prod: "prod_1wOB6i6NzGmBhrurQgsPfO"
          },
          premiumPro: {
            test: "prod_5mslrOqNn9rrmIzUJFRYr6",
            prod: "prod_4cVNXwHwb0RWl62USRMmuJ"
          }
        };
      }
    };
    const apiClient2 = axios.create({
      baseURL: API_URL2,
      headers: {
        "Content-Type": "application/json"
      }
    });
    apiClient2.interceptors.request.use(async (config) => {
      var _a;
      try {
        const { data } = await supabase.auth.getSession();
        const token = (_a = data.session) == null ? void 0 : _a.access_token;
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.warn("Failed to get Supabase session:", e);
      }
      return config;
    });
    const subscriptionClient2 = axios.create({
      baseURL: SUBSCRIPTION_API_URL2,
      headers: {
        "Content-Type": "application/json"
      }
    });
    const loadSubscriptionInfo = async () => {
      var _a;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Please sign in first");
        }
        const session = await supabase.auth.getSession();
        const response = await subscriptionClient2.get("/subscription/status", {
          params: { user_id: user.id },
          headers: {
            Authorization: `Bearer ${((_a = session.data.session) == null ? void 0 : _a.access_token) || user.id}`
          }
        });
        subscriptionInfo.value = response.data;
      } catch (error2) {
        console.error("Failed to load subscription info:", error2);
        subscriptionInfo.value = {
          planName: "Free",
          remainingTries: 0,
          totalTries: 1,
          period: "daily"
        };
      }
    };
    const syncSubscriptionFromCheckout = async (checkoutId, userId) => {
      try {
        console.log(`🔄 Attempting to sync subscription from checkout: ${checkoutId}`);
        const response = await subscriptionClient2.post("/subscription/sync-from-checkout", {
          checkoutId,
          userId
        });
        if (response.data.success) {
          console.log("✅ Subscription synced successfully");
          return true;
        }
        return false;
      } catch (err) {
        console.warn("Failed to sync subscription from checkout:", err);
        return false;
      }
    };
    const pollSubscriptionStatus = async (maxAttempts = 10, intervalMs = 2e3) => {
      var _a;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const session = await supabase.auth.getSession();
          const response = await subscriptionClient2.get("/subscription/status", {
            params: { user_id: user.id },
            headers: {
              Authorization: `Bearer ${((_a = session.data.session) == null ? void 0 : _a.access_token) || user.id}`
            }
          });
          const info = response.data;
          if (info.planName === "Premium" || info.planName === "premium" || info.planName === "Premium Plus" || info.planName === "premium_plus" || info.planName === "Premium Pro" || info.planName === "premium_pro") {
            subscriptionInfo.value = info;
            return true;
          }
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        } catch (err) {
          console.warn(`Polling attempt ${attempt + 1} failed:`, err);
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }
      }
      return false;
    };
    onMounted(async () => {
      if (typeof window === "undefined") return;
      await loadConfig();
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("success") === "true") {
        isLoading.value = true;
        const checkoutId = localStorage.getItem("pending_checkout_id");
        const savedUserId = localStorage.getItem("pending_checkout_user_id");
        const { data: { user } } = await supabase.auth.getUser();
        const userId = (user == null ? void 0 : user.id) || savedUserId;
        console.log("Payment success - checking for pending checkout:", { checkoutId, userId });
        await loadSubscriptionInfo();
        if (checkoutId && userId) {
          console.log("🔄 Attempting to sync subscription from checkout...");
          const synced = await syncSubscriptionFromCheckout(checkoutId, userId);
          if (synced) {
            await loadSubscriptionInfo();
            alert("Subscription activated! Premium features are now available.");
            isLoading.value = false;
            window.history.replaceState({}, "", "/pricing");
            return;
          }
        }
        alert("Payment successful. Confirming subscription status...");
        const updated = await pollSubscriptionStatus(10, 2e3);
        if (updated) {
          alert("Subscription activated! Premium features are now available.");
          if (checkoutId) localStorage.removeItem("pending_checkout_id");
          if (savedUserId) localStorage.removeItem("pending_checkout_user_id");
        } else {
          alert("Payment succeeded but the subscription may take time to update. If it does not update soon, please refresh or contact support.");
        }
        isLoading.value = false;
        window.history.replaceState({}, "", "/pricing");
      } else if (urlParams.get("canceled") === "true") {
        localStorage.removeItem("pending_checkout_id");
        localStorage.removeItem("pending_checkout_user_id");
        error.value = "Payment was canceled";
        window.history.replaceState({}, "", "/pricing");
      }
      await loadSubscriptionInfo();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4" }, _attrs))}><div class="max-w-7xl mx-auto"><div class="text-center mb-12"><h1 class="text-4xl font-bold text-gray-900 mb-4">Choose the plan that fits you</h1><p class="text-lg text-gray-600">Unlock more virtual try-on power</p></div><div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto"><div class="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 hover:border-blue-500 transition-all"><div class="text-center"><h2 class="text-2xl font-bold text-gray-900 mb-2">Free</h2><div class="mb-6"><span class="text-5xl font-bold text-gray-900">$0</span><span class="text-gray-600 ml-2">/mo</span></div><ul class="text-left space-y-4 mb-8"><li class="flex items-start"><svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span class="text-gray-700">3 virtual try-ons per day (first 3 tries are free for all plans)</span></li><li class="flex items-start"><svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span class="text-gray-700">Access to core features</span></li><li class="flex items-start"><svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span class="text-gray-700">Save your history</span></li></ul><button class="w-full py-3 px-6 rounded-lg font-semibold transition-all bg-gray-100 text-gray-900 hover:bg-gray-200"> Continue with Free </button></div></div><div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl border-2 border-blue-500 p-8 text-white relative transform hover:scale-105 transition-all"><div class="absolute -top-4 left-1/2 transform -translate-x-1/2"><span class="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold">Recommended</span></div><div class="text-center"><h2 class="text-2xl font-bold mb-2">Premium</h2><div class="mb-6"><span class="text-5xl font-bold">$5</span><span class="text-blue-100 ml-2">/mo</span></div><ul class="text-left space-y-4 mb-8"><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>50 virtual try-ons per month</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Includes all Free features</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Priority processing</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Unlimited history</span></li></ul><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="${ssrRenderClass([
        "w-full py-3 px-6 rounded-lg font-semibold transition-all",
        isLoading.value ? "bg-white/80 text-blue-600 cursor-wait" : "bg-white text-blue-600 hover:bg-blue-50"
      ])}">${ssrInterpolate(isLoading.value ? "Processing..." : "Subscribe now")}</button></div></div><div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl border-2 border-purple-500 p-8 text-white relative transform hover:scale-105 transition-all"><div class="text-center"><h2 class="text-2xl font-bold mb-2">Premium Plus</h2><div class="mb-6"><span class="text-5xl font-bold">$15</span><span class="text-purple-100 ml-2">/mo</span></div><ul class="text-left space-y-4 mb-8"><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>200 virtual try-ons per month</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Includes all Premium features</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Priority processing</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Unlimited history</span></li></ul><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="${ssrRenderClass([
        "w-full py-3 px-6 rounded-lg font-semibold transition-all",
        isLoading.value ? "bg-white/80 text-purple-600 cursor-wait" : "bg-white text-purple-600 hover:bg-purple-50"
      ])}">${ssrInterpolate(isLoading.value ? "Processing..." : "Subscribe now")}</button></div></div><div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-xl border-2 border-indigo-500 p-8 text-white relative transform hover:scale-105 transition-all"><div class="text-center"><h2 class="text-2xl font-bold mb-2">Premium Pro</h2><div class="mb-6"><span class="text-5xl font-bold">$29.9</span><span class="text-indigo-100 ml-2">/mo</span></div><ul class="text-left space-y-4 mb-8"><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>500 virtual try-ons per month</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Includes all Premium Plus features</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Priority processing</span></li><li class="flex items-start"><svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Unlimited history</span></li></ul><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="${ssrRenderClass([
        "w-full py-3 px-6 rounded-lg font-semibold transition-all",
        isLoading.value ? "bg-white/80 text-indigo-600 cursor-wait" : "bg-white text-indigo-600 hover:bg-indigo-50"
      ])}">${ssrInterpolate(isLoading.value ? "Processing..." : "Subscribe now")}</button></div></div></div>`);
      if (error.value) {
        _push(`<div class="mt-6 max-w-4xl mx-auto"><div class="bg-red-50 border border-red-200 rounded-lg p-4"><p class="text-red-800">${ssrInterpolate(error.value)}</p></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Pricing.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  ...{ name: "Profile" },
  __name: "Profile",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const SUBSCRIPTION_API_URL2 = "http://localhost:3001";
    const isLoading = ref(false);
    const error = ref(null);
    const subscriptionInfo = ref(null);
    const userEmail = ref("—");
    const isTestMode = ref(false);
    const productIds = ref(null);
    const loadConfig = async () => {
      try {
        const response = await subscriptionClient2.get("/config");
        isTestMode.value = response.data.isTestMode;
        productIds.value = response.data.productIds;
        console.log("Environment config loaded:", { isTestMode: isTestMode.value, productIds: productIds.value });
      } catch (error2) {
        console.error("Failed to load config from backend, using fallback:", error2);
        isTestMode.value = true;
        productIds.value = {
          premium: {
            test: "prod_1W4roSJevbLIRwQyb3a8SQ",
            prod: "prod_ZcR2OsakU427r5LppdXpe"
          },
          premiumPlus: {
            test: "prod_6YsIDqxb9lnMmVarSuUfBc",
            prod: "prod_1wOB6i6NzGmBhrurQgsPfO"
          },
          premiumPro: {
            test: "prod_5mslrOqNn9rrmIzUJFRYr6",
            prod: "prod_4cVNXwHwb0RWl62USRMmuJ"
          }
        };
      }
    };
    const subscriptionClient2 = axios.create({
      baseURL: SUBSCRIPTION_API_URL2,
      headers: {
        "Content-Type": "application/json"
      }
    });
    const planNameRaw = computed(() => {
      var _a;
      return ((_a = subscriptionInfo.value) == null ? void 0 : _a.planName) || "Free";
    });
    const planDisplay = computed(() => {
      var _a;
      const name = (planNameRaw.value || "").toString().toLowerCase();
      if (name === "premium_pro" || name === "premium pro") return "Premium Pro ($29.9)";
      if (name === "premium_plus" || name === "premium plus") return "Premium Plus ($15)";
      if (name === "premium") return "Premium ($5)";
      return ((_a = subscriptionInfo.value) == null ? void 0 : _a.planName) || "Free";
    });
    const planSlug = computed(() => {
      const name = (planNameRaw.value || "").toString().toLowerCase();
      if (name === "premium_pro" || name === "premium pro") return "premium_pro";
      if (name === "premium_plus" || name === "premium plus") return "premium_plus";
      if (name === "premium") return "premium";
      return "free";
    });
    const planRank = { free: 0, premium: 1, premium_plus: 2, premium_pro: 3 };
    const remainingTries = computed(() => {
      var _a;
      return ((_a = subscriptionInfo.value) == null ? void 0 : _a.remainingTries) ?? 0;
    });
    const totalTries = computed(() => {
      var _a;
      return ((_a = subscriptionInfo.value) == null ? void 0 : _a.totalTries) ?? 0;
    });
    const nextResetDate = computed(() => {
      var _a;
      const dateStr = (_a = subscriptionInfo.value) == null ? void 0 : _a.nextResetDate;
      if (!dateStr) return "";
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      } catch {
        return dateStr;
      }
    });
    const status = computed(() => {
      var _a;
      return getStatusText((_a = subscriptionInfo.value) == null ? void 0 : _a.status);
    });
    const getStatusText = (status2) => {
      if (!status2) return "Unknown";
      const statusMap = {
        active: "Active",
        canceled: "Canceled",
        expired: "Expired",
        trialing: "Trialing",
        past_due: "Past Due",
        unpaid: "Unpaid"
      };
      return statusMap[status2] || status2;
    };
    const loadSubscriptionInfo = async () => {
      var _a, _b, _c, _d, _e, _f;
      isLoading.value = true;
      error.value = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in first");
        userEmail.value = user.email || "—";
        const session = await supabase.auth.getSession();
        const response = await subscriptionClient2.get("/subscription/status", {
          params: { user_id: user.id },
          headers: {
            Authorization: `Bearer ${((_a = session.data.session) == null ? void 0 : _a.access_token) || user.id}`
          }
        });
        subscriptionInfo.value = response.data;
        const subscriptionId = ((_b = subscriptionInfo.value) == null ? void 0 : _b.subscriptionId) || ((_c = subscriptionInfo.value) == null ? void 0 : _c.subscription_id);
        if (subscriptionId && ((_d = subscriptionInfo.value) == null ? void 0 : _d.status) === "active") {
          setTimeout(async () => {
            try {
              await syncFromSubscription();
            } catch (e) {
              console.log("Background sync failed (this is ok):", e);
            }
          }, 2e3);
        }
      } catch (e) {
        console.error("Failed to load subscription info:", e);
        error.value = ((_f = (_e = e == null ? void 0 : e.response) == null ? void 0 : _e.data) == null ? void 0 : _f.error) || (e == null ? void 0 : e.message) || "Failed to load subscription info";
        subscriptionInfo.value = {
          planName: "Free",
          remainingTries: 0,
          totalTries: 1,
          period: "daily",
          status: "free"
        };
      } finally {
        isLoading.value = false;
      }
    };
    const goPricing = () => router.push("/pricing");
    const signOut = async () => {
      try {
        await supabase.auth.signOut();
        router.push("/login");
      } catch (e) {
        console.error("Failed to sign out", e);
      }
    };
    let portalOpenedTime = 0;
    const openPortal = async () => {
      var _a, _b, _c;
      const customerId = ((_a = subscriptionInfo.value) == null ? void 0 : _a.customerId) || ((_b = subscriptionInfo.value) == null ? void 0 : _b.customer_id);
      if (!customerId) {
        goPricing();
        return;
      }
      try {
        portalOpenedTime = Date.now();
        console.log("🚪 Opening customer portal, timestamp:", portalOpenedTime);
        const returnUrl = `${window.location.origin}/profile?from=portal`;
        const resp = await subscriptionClient2.post(`/customers/${customerId}/portal`, {
          returnUrl
          // 即使 Creem 不支持，我们也传递它，以防将来支持
        });
        const url = (_c = resp.data) == null ? void 0 : _c.portalUrl;
        if (url) {
          window.location.href = url;
        } else {
          goPricing();
        }
      } catch (e) {
        console.error("Failed to open portal", e);
        portalOpenedTime = 0;
        goPricing();
      }
    };
    const syncFromSubscription = async () => {
      var _a, _b;
      const subscriptionId = ((_a = subscriptionInfo.value) == null ? void 0 : _a.subscriptionId) || ((_b = subscriptionInfo.value) == null ? void 0 : _b.subscription_id);
      if (!subscriptionId) {
        return;
      }
      try {
        console.log("🔄 Syncing subscription from subscription ID:", subscriptionId);
        await subscriptionClient2.post("/subscription/sync-from-subscription", {
          subscriptionId
        });
        await loadSubscriptionInfo();
      } catch (e) {
        console.error("Failed to sync subscription:", e);
        await loadSubscriptionInfo();
      }
    };
    const getProductIdForPlan = async (target) => {
      var _a, _b, _c, _d, _e, _f;
      if (!productIds.value) {
        await loadConfig();
      }
      if (target === "premium_pro") {
        return isTestMode.value ? ((_a = productIds.value) == null ? void 0 : _a.premiumPro.test) || "" : ((_b = productIds.value) == null ? void 0 : _b.premiumPro.prod) || "";
      }
      if (target === "premium_plus") {
        return isTestMode.value ? ((_c = productIds.value) == null ? void 0 : _c.premiumPlus.test) || "" : ((_d = productIds.value) == null ? void 0 : _d.premiumPlus.prod) || "";
      }
      return isTestMode.value ? ((_e = productIds.value) == null ? void 0 : _e.premium.test) || "" : ((_f = productIds.value) == null ? void 0 : _f.premium.prod) || "";
    };
    const upgradeSubscription = async (target) => {
      var _a, _b, _c, _d, _e, _f, _g;
      const subscriptionId = ((_a = subscriptionInfo.value) == null ? void 0 : _a.subscriptionId) || ((_b = subscriptionInfo.value) == null ? void 0 : _b.subscription_id);
      if (!subscriptionId) {
        return startCheckout(target);
      }
      try {
        isLoading.value = true;
        error.value = null;
        const currentRank = planRank[planSlug.value] ?? 0;
        const targetRank = planRank[target] ?? 0;
        const isUpgrade = targetRank > currentRank;
        const updateBehavior = isUpgrade ? "proration-charge-immediately" : "proration-charge";
        const productId = await getProductIdForPlan(target);
        await subscriptionClient2.post(`/subscriptions/${subscriptionId}/upgrade`, {
          productId,
          updateBehavior
        });
        await loadSubscriptionInfo();
        alert(`Subscription ${isUpgrade ? "upgraded" : "downgraded"} successfully!`);
      } catch (e) {
        console.error("Failed to upgrade/downgrade subscription", e);
        const errorMsg = ((_d = (_c = e == null ? void 0 : e.response) == null ? void 0 : _c.data) == null ? void 0 : _d.error) || ((_f = (_e = e == null ? void 0 : e.response) == null ? void 0 : _e.data) == null ? void 0 : _f.message) || (e == null ? void 0 : e.message) || "Failed to update subscription";
        error.value = errorMsg;
        if (errorMsg.includes("Forbidden") || ((_g = e == null ? void 0 : e.response) == null ? void 0 : _g.status) === 403) {
          const usePortal = confirm("Direct upgrade/downgrade is not available. Would you like to manage your subscription through the customer portal?");
          if (usePortal) {
            openPortal();
          }
        }
      } finally {
        isLoading.value = false;
      }
    };
    const startCheckout = async (target) => {
      var _a, _b;
      try {
        isLoading.value = true;
        error.value = null;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in first");
        const productId = await getProductIdForPlan(target);
        const response = await subscriptionClient2.post("/checkouts", {
          productId,
          successUrl: `${window.location.origin}/pricing?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
          metadata: { userId: user.id }
        });
        if (response.data.checkoutUrl) {
          window.location.href = response.data.checkoutUrl;
        } else {
          throw new Error("Unable to create checkout session");
        }
      } catch (e) {
        console.error("Failed to start checkout", e);
        error.value = ((_b = (_a = e == null ? void 0 : e.response) == null ? void 0 : _a.data) == null ? void 0 : _b.error) || (e == null ? void 0 : e.message) || "Failed to start checkout";
      } finally {
        isLoading.value = false;
      }
    };
    const cancelSubscription = async () => {
      var _a, _b;
      const subscriptionId = ((_a = subscriptionInfo.value) == null ? void 0 : _a.subscriptionId) || ((_b = subscriptionInfo.value) == null ? void 0 : _b.subscription_id);
      if (!subscriptionId) {
        goPricing();
        return;
      }
      try {
        isLoading.value = true;
        await subscriptionClient2.post(`/subscriptions/${subscriptionId}/cancel`);
        await loadSubscriptionInfo();
      } catch (e) {
        console.error("Failed to cancel subscription", e);
      } finally {
        isLoading.value = false;
      }
    };
    const plans = computed(() => [
      {
        slug: "free",
        name: "Free",
        price: "$0",
        tries: "3/day",
        desc: "Core features and saved history",
        action: () => cancelSubscription()
        // downgrade to free via cancel
      },
      {
        slug: "premium",
        name: "Premium",
        price: "$5 / mo",
        tries: "50 / month",
        desc: "More try-ons and priority",
        action: () => upgradeSubscription("premium")
      },
      {
        slug: "premium_plus",
        name: "Premium Plus",
        price: "$15 / mo",
        tries: "200 / month",
        desc: "Higher limits and priority",
        action: () => upgradeSubscription("premium_plus")
      },
      {
        slug: "premium_pro",
        name: "Premium Pro",
        price: "$29.9 / mo",
        tries: "500 / month",
        desc: "Highest limits and priority",
        action: () => upgradeSubscription("premium_pro")
      }
    ]);
    const actionLabel = (slug) => {
      if (slug === planSlug.value) return "Current plan";
      const currentRank = planRank[planSlug.value] ?? 0;
      const targetRank = planRank[slug] ?? 0;
      return targetRank > currentRank ? "Upgrade" : "Downgrade";
    };
    const isActionDisabled = (slug) => slug === planSlug.value || isLoading.value;
    onMounted(async () => {
      await loadConfig();
      await loadSubscriptionInfo();
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("from") === "portal") {
        console.log("🔄 Detected return from portal via URL parameter");
        setTimeout(() => {
          syncFromSubscription();
        }, 1e3);
        window.history.replaceState({}, "", "/profile");
      }
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          const now = Date.now();
          if (portalOpenedTime > 0 && now - portalOpenedTime < 10 * 60 * 1e3) {
            const minutesSincePortal = Math.floor((now - portalOpenedTime) / 6e4);
            console.log(`🔄 Page became visible ${minutesSincePortal} minutes after portal visit, syncing subscription status`);
            syncFromSubscription();
            portalOpenedTime = 0;
          } else {
            loadSubscriptionInfo();
          }
        }
      });
      window.addEventListener("focus", () => {
        const now = Date.now();
        if (portalOpenedTime > 0 && now - portalOpenedTime < 10 * 60 * 1e3) {
          const minutesSincePortal = Math.floor((now - portalOpenedTime) / 6e4);
          console.log(`🔄 Window focused ${minutesSincePortal} minutes after portal visit, syncing subscription status`);
          syncFromSubscription();
          portalOpenedTime = 0;
        }
      });
    });
    return (_ctx, _push, _parent, _attrs) => {
      var _a;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50" }, _attrs))}><main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12"><div class="max-w-4xl mx-auto space-y-8"><div><h1 class="text-3xl font-bold text-gray-900">Profile</h1><p class="text-gray-600 mt-2">View your subscription status and remaining tries</p></div><div class="grid gap-6 md:grid-cols-2"><div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"><div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold text-gray-900">Subscription</h2><span class="text-sm text-gray-500">${ssrInterpolate(isLoading.value ? "Loading..." : "Updated")}</span></div><div class="space-y-3"><div class="flex justify-between text-sm text-gray-600"><span>Current plan</span><span class="font-semibold text-gray-900">${ssrInterpolate(planDisplay.value)}</span></div><div class="flex justify-between text-sm text-gray-600"><span>Status</span><span class="font-semibold text-gray-900">${ssrInterpolate(status.value)}</span></div><div class="flex justify-between text-sm text-gray-600"><span>Remaining tries</span><span class="font-semibold text-gray-900">${ssrInterpolate(remainingTries.value)} / ${ssrInterpolate(totalTries.value)}</span></div>`);
      if (nextResetDate.value) {
        _push(`<div class="flex justify-between text-sm text-gray-600"><span>Next reset</span><span class="font-semibold text-gray-900">${ssrInterpolate(nextResetDate.value)}</span></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (planSlug.value !== "free" && (status.value === "Active" || status.value === "Trialing")) {
        _push(`<div class="mt-4 pt-4 border-t border-gray-200">`);
        _push(ssrRenderComponent(unref(_sfc_main$j), {
          variant: "outline",
          class: "w-full text-red-600 hover:text-red-700 hover:bg-red-50",
          disabled: isLoading.value,
          onClick: cancelSubscription
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(` Cancel Subscription `);
            } else {
              return [
                createTextVNode(" Cancel Subscription ")
              ];
            }
          }),
          _: 1
        }, _parent));
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (error.value) {
        _push(`<p class="mt-3 text-sm text-red-600">${ssrInterpolate(error.value)}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"><div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold text-gray-900">Account</h2></div><div class="space-y-3 text-sm text-gray-700"><p>Sign-in email: <span class="font-semibold">${ssrInterpolate(userEmail.value)}</span></p><p>Billing period: <span class="font-semibold">${ssrInterpolate(((_a = subscriptionInfo.value) == null ? void 0 : _a.period) || "daily")}</span></p><p>Tip: upgrade to get more try-ons and priority processing.</p></div><div class="mt-6 space-y-3">`);
      _push(ssrRenderComponent(unref(_sfc_main$j), {
        variant: "outline",
        class: "w-full",
        onClick: openPortal
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`Customer Portal`);
          } else {
            return [
              createTextVNode("Customer Portal")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(unref(_sfc_main$j), {
        variant: "secondary",
        class: "w-full",
        onClick: signOut
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`Sign out`);
          } else {
            return [
              createTextVNode("Sign out")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></div></div><div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"><div class="flex items-center justify-between"><h2 class="text-lg font-semibold text-gray-900">Plans</h2><span class="text-sm text-gray-500">Upgrade or downgrade</span></div><div class="grid gap-4 md:grid-cols-3"><!--[-->`);
      ssrRenderList(plans.value, (plan) => {
        _push(`<div class="${ssrRenderClass([plan.slug === planSlug.value ? "border-blue-500 bg-blue-50/50" : "border-gray-200", "border rounded-xl p-4 space-y-3"])}"><div class="flex items-center justify-between"><div><p class="font-semibold text-gray-900">${ssrInterpolate(plan.name)}</p><p class="text-sm text-gray-500">${ssrInterpolate(plan.price)}</p></div>`);
        if (plan.slug === planSlug.value) {
          _push(`<span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Current</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><p class="text-sm text-gray-600">Includes: ${ssrInterpolate(plan.tries)}</p><p class="text-sm text-gray-500">${ssrInterpolate(plan.desc)}</p>`);
        _push(ssrRenderComponent(unref(_sfc_main$j), {
          class: "w-full",
          variant: plan.slug === planSlug.value ? "outline" : "default",
          disabled: isActionDisabled(plan.slug),
          onClick: ($event) => plan.action()
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(`${ssrInterpolate(actionLabel(plan.slug))}`);
            } else {
              return [
                createTextVNode(toDisplayString(actionLabel(plan.slug)), 1)
              ];
            }
          }),
          _: 2
        }, _parent));
        _push(`</div>`);
      });
      _push(`<!--]--></div></div></div></main></div>`);
    };
  }
});
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/Profile.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "AppLayout",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      const _component_router_view = resolveComponent("router-view");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 font-sans text-gray-900" }, _attrs))}><nav class="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"><div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/",
        class: "flex items-center space-x-2"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<span class="text-2xl font-bold tracking-tight"${_scopeId}>Fashion Rec</span>`);
          } else {
            return [
              createVNode("span", { class: "text-2xl font-bold tracking-tight" }, "Fashion Rec")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<div class="flex items-center gap-4">`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/studio",
        class: "text-sm text-gray-600 hover:text-black"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`Studio`);
          } else {
            return [
              createTextVNode("Studio")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(_component_router_link, {
        to: "/wardrobe",
        class: "text-sm text-gray-600 hover:text-black"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`Wardrobe`);
          } else {
            return [
              createTextVNode("Wardrobe")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(_component_router_link, {
        to: "/tryon-history",
        class: "text-sm text-gray-600 hover:text-black"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`Outfit History`);
          } else {
            return [
              createTextVNode("Outfit History")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(_component_router_link, {
        to: "/favorites",
        class: "text-sm text-gray-600 hover:text-black flex items-center gap-1"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(ssrRenderComponent(unref(Heart), { class: "w-4 h-4" }, null, _parent2, _scopeId));
            _push2(` Favorites `);
          } else {
            return [
              createVNode(unref(Heart), { class: "w-4 h-4" }),
              createTextVNode(" Favorites ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(_component_router_link, {
        to: "/profile",
        class: "text-sm text-gray-600 hover:text-black flex items-center gap-1"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(ssrRenderComponent(unref(User), { class: "w-4 h-4" }, null, _parent2, _scopeId));
            _push2(` Profile `);
          } else {
            return [
              createVNode(unref(User), { class: "w-4 h-4" }),
              createTextVNode(" Profile ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></div></nav><main>`);
      _push(ssrRenderComponent(_component_router_view, null, null, _parent));
      _push(`</main></div>`);
    };
  }
});
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/layouts/AppLayout.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "HomeLayout",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const authStore = useAuthStore();
    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const handleGetStarted = () => {
      if (isAuthenticated.value) {
        router.push("/studio");
      } else {
        router.push("/login");
      }
    };
    const buttonText = computed(() => {
      return isAuthenticated.value ? "Enter Studio" : "Start for Free";
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      const _component_router_view = resolveComponent("router-view");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-white" }, _attrs))} data-v-94ba4dea><nav class="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60" data-v-94ba4dea><div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8" data-v-94ba4dea>`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/",
        class: "flex items-center space-x-2"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<span class="text-2xl font-bold tracking-tight" data-v-94ba4dea${_scopeId}>Fashion Rec</span>`);
          } else {
            return [
              createVNode("span", { class: "text-2xl font-bold tracking-tight" }, "Fashion Rec")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<div class="flex items-center" data-v-94ba4dea>`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/pricing",
        class: "text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 mr-4"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(` 💎 Pricing `);
          } else {
            return [
              createTextVNode(" 💎 Pricing ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(unref(_sfc_main$j), {
        onClick: handleGetStarted,
        variant: "default",
        size: "lg",
        class: "font-bold text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`${ssrInterpolate(buttonText.value)}`);
          } else {
            return [
              createTextVNode(toDisplayString(buttonText.value), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></div></nav>`);
      _push(ssrRenderComponent(_component_router_view, null, null, _parent));
      _push(`</div>`);
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/layouts/HomeLayout.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const HomeLayout = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-94ba4dea"]]);
const routes = [
  {
    path: "/",
    component: HomeLayout,
    children: [
      {
        path: "",
        name: "home",
        component: _sfc_main$e
      },
      {
        path: "pricing",
        name: "pricing",
        component: _sfc_main$3
      }
    ]
  },
  {
    path: "/",
    component: _sfc_main$1,
    children: [
      {
        path: "studio",
        name: "studio",
        component: _sfc_main$d,
        meta: { requiresAuth: true }
      },
      {
        path: "wardrobe",
        name: "wardrobe",
        component: _sfc_main$9,
        meta: { requiresAuth: true }
      },
      {
        path: "lv-products",
        name: "lv-products",
        component: LVProducts,
        meta: { requiresAuth: true }
      },
      {
        path: "favorites",
        name: "favorites",
        component: _sfc_main$7,
        meta: { requiresAuth: true }
      },
      {
        path: "tryon-history",
        name: "tryon-history",
        component: _sfc_main$6,
        meta: { requiresAuth: true }
      },
      {
        path: "privacy-policy",
        name: "privacy-policy",
        component: PrivacyPolicy
      },
      {
        path: "terms-of-service",
        name: "terms-of-service",
        component: TermsOfService
      },
      {
        path: "profile",
        name: "profile",
        component: _sfc_main$2,
        meta: { requiresAuth: true }
      }
    ]
  },
  {
    path: "/login",
    name: "login",
    component: _sfc_main$c
  },
  {
    path: "/callback",
    name: "callback",
    component: _sfc_main$b
  },
  {
    path: "/reset-password",
    name: "reset-password",
    component: _sfc_main$a
  }
];
const setupRouterGuards = (router2) => {
  router2.beforeEach(async (to, _from, next) => {
    if (typeof window === "undefined") {
      next();
      return;
    }
    const authStore = useAuthStore();
    if (authStore.isLoading) {
      await authStore.loadSession();
    }
    if (to.meta.requiresAuth) {
      if (!authStore.isAuthenticated) {
        next({ name: "login", query: { redirect: to.fullPath } });
        return;
      }
    }
    next();
  });
};
const createAppRouter = () => {
  const history = typeof window === "undefined" ? createMemoryHistory("/") : createWebHistory("/");
  const router2 = createRouter({
    history,
    routes
  });
  setupRouterGuards(router2);
  return router2;
};
createAppRouter();
const createApp = ViteSSG(
  _sfc_main$k,
  {
    routes,
    base: "/"
  },
  ({ app, router }) => {
    const head = createHead$2();
    app.use(head);
    const pinia = createPinia();
    pinia.use(piniaPluginPersistedstate);
    app.use(pinia);
    setupRouterGuards(router);
  }
);
export {
  createApp
};
