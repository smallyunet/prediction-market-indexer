export function parseBigintJsonArray(value: unknown, length: number): bigint[] {
    if (Array.isArray(value)) {
        const arr = value.slice(0, length).map((v) => {
            if (typeof v === "bigint") return v;
            if (typeof v === "number") return BigInt(Math.floor(v));
            if (typeof v === "string") return BigInt(v);
            return 0n;
        });
        while (arr.length < length) arr.push(0n);
        return arr;
    }
    return Array.from({ length }, () => 0n);
}

export function bigintArrayToJson(arr: bigint[]): string[] {
    return arr.map((v) => v.toString());
}
