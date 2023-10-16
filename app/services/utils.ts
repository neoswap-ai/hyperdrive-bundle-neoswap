import { Connection, PublicKey } from "@solana/web3.js";
import { InOutAtlasBundle } from "./starAtlas";

export function idToKey(id: string) {
    return id.split("solana-")[1];
}

export async function getSolBalance(user: string | PublicKey) {
    const connection = new Connection(
        "https://compatible-late-wildflower.solana-mainnet.quiknode.pro/58382ac09eaaeea48164b2f768abeb4b522bf3e0/"
    );
    user = new PublicKey(user.toString());
    return await connection.getBalance(user);
}

export function stateToBuy(state: any): InOutAtlasBundle {
    let toBuy: InOutAtlasBundle = { atlas: { atlas: { amount: 0 } }, gMListToBuy: [] };
    let itemToBuy: InOutAtlasBundle["gMListToBuy"] = [];
    for (const key in state) {
        let elem = state[key];
        if (Number(elem) < 0) {
            alert("Quantity must be positive");
            throw `Quantity must be positive \n ${key} - ${Number(elem)}`;
        }
        if (key.toLocaleLowerCase().includes("atlas")) {
            toBuy.atlas.atlas.amount = Number(elem);
        } else {
            itemToBuy.push({ mint: idToKey(key), quantity: Number(elem) });
        }
    }
    toBuy.gMListToBuy = itemToBuy;
    // console.log(toBuy);
    return toBuy;
}

export async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
