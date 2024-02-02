function FunctionalPrototype() {
  return <></>;
}

const NodePrototype = <FunctionalPrototype />;
const FragmentPrototype = <></>;

export default class NodeSerializer {
  #store = new Map<string, Function>();
  #fixKeys(objs: { key: number }[]) {
    if (objs.find((x) => x.key !== null)) {
      return objs;
    }
    let idx = 0;
    for (const obj of objs) {
      obj.key = idx++;
    }
    return objs;
  }
  #deserializeSingle(obj: any): any {
    if (Array.isArray(obj)) {
      return this.#fixKeys(
        obj.map((item: any) => this.#deserializeSingle(item))
      );
    }
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.react === "string" &&
      typeof obj.type === "string"
    ) {
      return this.#deserializeObject(obj);
    }

    if (typeof obj === "object") {
      return this.#deserializeProps(obj);
    }

    return obj;
  }
  #serializeSingle(obj: any): any {
    if (obj instanceof Function) {
      throw new Error(`Cannot serialize a function property`);
    }

    if (Array.isArray(obj)) {
      return obj.map((item: any) => this.#serializeSingle(item));
    }

    if (
      typeof obj === "object" &&
      obj !== null &&
      (NodePrototype as any)["$$typeof"] === obj["$$typeof"]
    ) {
      return this.#serializeObject(obj);
    }

    if (typeof obj === "object") {
      return this.#serializeProps(obj);
    }

    return obj;
  }

  #serializeProps(props: object) {
    const serializedPropEntries: [string, any][] = [];
    for (const [key, value] of Object.entries(props)) {
      serializedPropEntries.push([key, this.#serializeSingle(value)]);
    }
    return Object.fromEntries(serializedPropEntries);
  }

  #deserializeProps(serializedProps: object) {
    const deserializedPropEntries: [string, any][] = [];

    for (const [key, value] of Object.entries(serializedProps)) {
      deserializedPropEntries.push([key, this.#deserializeSingle(value)]);
    }

    return Object.fromEntries(deserializedPropEntries);
  }

  #serializeObject(node: JSX.Element) {
    let type: any;
    if (node.type instanceof Function) {
      type = node.type.name;
      if (!this.#store.has(type)) {
        throw new Error(`Component not registered: ${type}`);
      }
    } else if (typeof node.type === "string") {
      type = node.type;
    } else {
      if (node.type === FragmentPrototype.type) {
        type = "fragment";
      } else if (typeof node.type === "object" && "render" in node.type) {
        type = node.type;
      } else {
        throw new Error(`Invalid node type: ${typeof node.type}`);
      }
    }

    return {
      react:
        node.type instanceof Function
          ? "func"
          : typeof node.type === "string"
          ? "html"
          : typeof node.type === "object" && "render" in node.type
          ? "exotic"
          : type,
      type:
        typeof node.type === "object" && "render" in node.type
          ? node.type.render.name
          : type,
      props: this.#serializeProps(node.props),
      key: node.key,
    };
  }

  #deserializeObject(parsed: {
    props: any;
    type: string;
    react: "func" | "html" | "fragment" | "exotic";
    key: any;
  }) {
    if (parsed.react == "func" && !this.#store.has(parsed.type)) {
      throw new Error(`Component not registered: ${parsed.type}`);
    }
    let type =
      this.#store.get(parsed.type) ??
      (parsed.react === "fragment" ? FragmentPrototype.type : parsed.type);

    if (parsed.react === "exotic") {
      const Component = type;
      const ComponentPrototype = <Component />;
      type = ComponentPrototype.type;
    }
    return {
      ...NodePrototype,
      props: this.#deserializeProps(parsed.props),
      type: type,
      key: parsed.key,
    };
  }

  serialize(node: JSX.Element, json: boolean = true): any {
    const data = this.#serializeObject(node);
    if (json) {
      return JSON.stringify(data);
    } else {
      return data;
    }
  }

  deserialize(value: any, json: boolean = true): JSX.Element {
    const parsed = (json ? JSON.parse(value) : value) as {
      props: any;
      type: string;
      react: "func" | "html" | "fragment" | "exotic";
      key: any;
    };
    if (
      !(
        parsed.react === "func" ||
        parsed.react === "html" ||
        parsed.react === "fragment" ||
        parsed.react === "exotic"
      )
    ) {
      throw new Error(`Serialized object is not a valid react component`);
    }
    return this.#deserializeObject(parsed);
  }

  register<T extends Function>(component: T) {
    const name =
      component.name ??
      ("render" in component
        ? (component as unknown as { render: { name: string } }).render.name
        : undefined);

    if (!name) {
      throw new Error(`Invalid component`);
    }

    if (this.#store.has(name)) {
      if (this.#store.get(name) !== component)
        throw new Error(
          `Cannot register a component with the name '${name}' because a component with the same name has already been registered.`
        );
    }
    this.#store.set(name, component);
  }
}
