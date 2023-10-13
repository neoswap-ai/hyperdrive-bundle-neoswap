import { Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    VersionedTransaction,
    clusterApiUrl,
} from "@solana/web3.js";
import { GmClientService, Order } from "@staratlas/factory";
import { delay } from "./utils";
//@ts-ignore
import { TOKEN_PROGRAM_ID, createTransferInstruction } from "@solana/spl-token";
import { neoSwap } from "@neoswap/solana";
// import { StandardWalletAdapter } from "@solana/wallet-adapter-base";
// import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
// import { Wallet } from "@solana/wallet-adapter-react";

export const STAR_ATLAS_PROGRAM = new PublicKey("traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg");
export const ATLAS_MINT = new PublicKey("ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx");

const buyAtlasFromJupiterIx = async (Data: {
    user: PublicKey;
    quantityInAtlas: number;
    maxPrice?: number;
    connection?: Connection;
}): Promise<VersionedTransaction> => {
    // console.log("solanaEallet", solanaWallet);

    if (!Data.connection)
        Data.connection = new Connection(
            "https://neoswap-maind65-46ed.mainnet.rpcpool.com"
            // clusterApiUrl("mainnet-beta")
        );
    const route = (
        await (
            await fetch(
                `https://quote-api.jup.ag/v4/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${ATLAS_MINT.toBase58()}&amount=${
                    Math.ceil(Data.quantityInAtlas) + 1
                }&swapMode=ExactOut&slippageBps=50` //&platformFeeBps=15
            )
        ).json()
    ).data[0];
    console.log("ATLAS buying route", route);
    // console.log("route", route.outAmount / route.inAmount);
    // console.log("route", maxPrice);
    // console.log("OUT AMOUONT", route.outAmount);

    if (Data.maxPrice && route.outAmount / route.inAmount < Data.maxPrice) {
        throw `price of atlas against sol is too low ${
            Math.ceil((route.outAmount / route.inAmount) * 100) / 100
        } < ${Data.maxPrice}`;
    }

    const { swapTransaction } = await (
        await fetch("https://quote-api.jup.ag/v4/swap", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                route,
                userPublicKey: Data.user.toString(),
                wrapAndUnwrapSol: true,
                // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
                // feeAccount,
            }),
        })
    ).json();
    if (!swapTransaction) {
        console.log("route", route);

        throw "no swapTransaction, cannot buy from Jupiter, please retry";
    }
    let vTransaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
    vTransaction.message.recentBlockhash = (await Data.connection.getLatestBlockhash()).blockhash;
    // console.log("vTransaction", vTransaction);
    return vTransaction;
};
const buyMintListFromGMIx = async (
    Data: { list: InOutAtlasBundle["gMListToBuy"]; user: PublicKey } // { mint: PublicKey; quantity: number }[]
): Promise<{ ixs: TransactionInstruction[]; priceBought: number }[]> => {
    const gmClientService = new GmClientService();
    console.log("Data", Data);

    const buyOrders = await getStarAtlasOrders(Data.list);
    console.log("buyOrders", buyOrders);

    // console.log("provider", provider);

    return await Promise.all(
        buyOrders.map(async (orderData) => {
            console.log("\nXXXX\n ", orderData.order, orderData);
            const exchangeTx = await gmClientService.getCreateExchangeTransaction(
                new Connection(
                    // clusterApiUrl("mainnet-beta")
                    "https://neoswap-maind65-46ed.mainnet.rpcpool.com"
                ),
                orderData.order,
                Data.user,
                orderData.quantity,
                STAR_ATLAS_PROGRAM
            );
            // console.log("exchangeTx", exchangeTx);
            const buyPrice = orderData.order.priceForQuantity(orderData.quantity);
            // console.log("buyPrice", buyPrice * 10 ** 8);

            return {
                ixs: exchangeTx.transaction.instructions,
                priceBought: buyPrice,
            };
        })
    );
    // }
};
const getStarAtlasOrders = async (list: InOutAtlasBundle["gMListToBuy"]) => {
    console.log("LLLLIST", list);

    const gmClientService = new GmClientService();

    const allOrders = (
        await gmClientService.getAllOpenOrders(
            new Connection(
                // clusterApiUrl("mainnet-beta")
                "https://neoswap-maind65-46ed.mainnet.rpcpool.com"
            ),
            STAR_ATLAS_PROGRAM
        )
    ).filter((order) => {
        return order.uiPrice !== 0;
    });

    // console.log("allOrders", allOrders);

    const sellingOrders = allOrders.filter((order) => order.orderType === "sell");

    let returnArray: {
        order: Order;
        mint: string;
        quantity: number;
        hash?: string | undefined;
        maxPrice?: number | undefined;
    }[] = [];
    for (let index = 0; index < list.length; index++) {
        const item = list[index];

        let orders = sellingOrders
            // .filter((order) => order.orderQtyRemaining >= item.quantity)
            .filter((order) => order.orderMint.includes(item.mint))
            .filter((order) => order.currencyMint.includes(ATLAS_MINT.toBase58()))
            .sort((orderA, orderB) => orderA.uiPrice - orderB.uiPrice);
        if (orders.length === 0) throw "no orders found";
        // console.log(
        //     item.mint,
        //     `\n`,
        //     item.maxPrice,
        //     "xx - xx",
        //     orders[0].price.toNumber() * item.quantity
        // );
        let quantity = item.quantity;
        for (let index = 0; index < orders.length; index++) {
            const order = orders[index];

            if (!!item.maxPrice && order.price.toNumber() * item.quantity > item.maxPrice)
                throw `item too pricy ${order.price.toNumber() * item.quantity} (front) > (back) ${
                    item.maxPrice
                }`;
            // console.log(order.orderQtyRemaining, "(GM) QUANTITIS (rest)", quantity);

            if (order.orderQtyRemaining >= quantity) {
                // quantity = 0;
                returnArray.push({
                    order: order,
                    mint: item.mint,
                    quantity: quantity,
                    maxPrice: item.maxPrice,
                });
                break;
            } else {
                quantity -= order.orderQtyRemaining;
                returnArray.push({
                    order: order,
                    mint: item.mint,
                    quantity: order.orderQtyRemaining,
                    maxPrice: item.maxPrice,
                });
            }
        }
    }
    return returnArray;
    // return await Promise.all(list.map((item) => {}));
};
const sendLamportsIx = async (Data: {
    from: PublicKey;
    to: PublicKey;
    mint: PublicKey;
    uiAmount: number;
    connection?: Connection;
    mintAta?: string[];
}): Promise<{ ixs: TransactionInstruction[]; mintAta: string[] }> => {
    let mintAta: string[] = [];
    console.log("Data", Data.mintAta);

    if (!!Data.mintAta) mintAta = Data.mintAta;

    if (!Data.connection)
        Data.connection = new Connection(
            "https://neoswap-maind65-46ed.mainnet.rpcpool.com"
            // clusterApiUrl("mainnet-beta")
        );

    // program.provider.connection.token
    let { mintAta: fromRevenueAta } = await neoSwap.UTILS.findOrCreateAta({
        mint: Data.mint,
        owner: Data.from,
        signer: Data.from,
        connection: Data.connection,
    });
    let { mintAta: toRevenueAta, instruction: destAta } = await neoSwap.UTILS.findOrCreateAta({
        mint: Data.mint,
        owner: Data.to,
        signer: Data.from,
        //@ts-ignore
        program,
    });

    let ixs: TransactionInstruction[] = [];
    if (!!destAta && !mintAta?.includes(toRevenueAta.toBase58())) {
        console.log("destAta", toRevenueAta.toBase58());
        ixs.push(destAta);
        mintAta.push(toRevenueAta.toBase58());
    }
    ixs.push(
        createTransferInstruction(
            fromRevenueAta,
            toRevenueAta,
            Data.from,
            Data.uiAmount,
            [],
            TOKEN_PROGRAM_ID
        )
    );
    return { ixs, mintAta };
};
export type InOutAtlasBundle = {
    atlas: {
        minPrice?: number;
        atlas: {
            amount: number;
            hash?: string;
        };
        fees?: { [name: string]: { amount: number; address: string; hash?: string } };
    };
    gMListToBuy: { mint: string; quantity: number; hash?: string; maxPrice?: number }[];
};
export const getStarAtlasBundle = async (Data: {
    toBuy: InOutAtlasBundle;
    user: PublicKey;
    wallet: Wallet;
}): Promise<InOutAtlasBundle> => {
    // console.log("solanaWallet", solanaWallet);

    const connection = new Connection(
        "https://neoswap-maind65-46ed.mainnet.rpcpool.com"
        // clusterApiUrl("mainnet-beta")
    );
    let broadcastVTx: VersionedTransaction[] = [];
    // let feeAmount = 0;
    let feeAmount = 0;
    for (const key in Data.toBuy.atlas.fees) {
        const fee = Data.toBuy.atlas.fees[key];
        feeAmount += fee.amount;
    }
    console.log("feeAmount", feeAmount);
    let hasFees = feeAmount > 0 ? 1 : 0;
    let toBuyFromDex = (Data.toBuy.atlas.atlas.amount + feeAmount) * 10 ** 8;
    console.log("ATLAS to buy from DEX minus GM", toBuyFromDex);

    // let atlasBought = 0;
    let buyFromGmTxs: TransactionInstruction[][] = [];
    if (Data.toBuy.gMListToBuy.length > 0) {
        let buyFromGMData = await buyMintListFromGMIx({
            list: Data.toBuy.gMListToBuy,
            user: Data.user,
        });
        // console.log("buyFromGMData", buyFromGMData);
        if (buyFromGMData.length === 0) throw "couldn't buy from GM";

        let atlasConsumedInGM = 0;
        buyFromGMData.map((acc) => {
            atlasConsumedInGM += acc.priceBought;
        });
        console.log(
            "ATLAS consumed in GM",
            atlasConsumedInGM,
            "\n for these mint\n",
            Data.toBuy.gMListToBuy.map((item) => {
                return { mint: item.mint, amount: item.quantity };
            })
        );

        toBuyFromDex += atlasConsumedInGM * 10 ** 8;
        buyFromGMData.map((item) => buyFromGmTxs.push(item.ixs));
        // console.log("feeAmount2", feeAmount);
    }
    console.log("ATLAS to buy from DEX", toBuyFromDex);

    const buyAtlasData = await buyAtlasFromJupiterIx({
        quantityInAtlas: toBuyFromDex,
        maxPrice: Data.toBuy.atlas.minPrice,
        user: Data.user,
        connection,
    });
    buyAtlasData.message.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    let somuTx = await connection.simulateTransaction(buyAtlasData);
    // console.log("somuTx", somuTx);
    if (!!somuTx.value.err)
        throw String(somuTx.value.logs).includes("insufficient lamports")
            ? "couldn't buy from Jupiter because lack of funds"
            : !!somuTx.value.err
            ? "error: " + somuTx.value.err
            : String(somuTx.value.logs);
    broadcastVTx.push(buyAtlasData);
    broadcastVTx.push(...(await ix2vTx(buyFromGmTxs, Data.user, connection)));

    let ixToSend: TransactionInstruction[] | undefined = [];
    let mintAta: string[] = [];
    for (const key in Data.toBuy.atlas.fees) {
        let feeUserData = Data.toBuy.atlas.fees[key];
        if (feeUserData.amount > 0) {
            let uiAmount = Math.ceil(feeUserData.amount * 10 ** 8);
            let feeAddress = new PublicKey(feeUserData.address);
            let feeIxData = await sendLamportsIx({
                from: Data.user,
                to: feeAddress,
                mint: ATLAS_MINT,
                uiAmount,
                mintAta,
                connection,
            });
            // console.log("feeIxData", feeIxData);
            mintAta = feeIxData.mintAta;
            ixToSend.push(...feeIxData.ixs);
            console.log("Added Fees for ", key, "  ", uiAmount, " to ", feeAddress.toBase58());
        }
    }
    if (ixToSend.length > 0)
        broadcastVTx.push(
            new VersionedTransaction(new Transaction().add(...ixToSend).compileMessage())
        );

    console.log("there are ", broadcastVTx.length, "transactions to be sent");
    if (!Data.wallet.signAllTransactions) throw "no solanaWallet.signAllTransactions";
    let Latest_BHsh = (await connection.getLatestBlockhash()).blockhash;
    broadcastVTx.map(async (tx) => {
        tx.message.recentBlockhash = Latest_BHsh;
    });
    const signedTxs = await Data.wallet.signAllTransactions(broadcastVTx);
    // const signedTxs = await connection.simulateTransaction(broadcastVTx);

    let first = true;
    let hashs: string[] = [];
    if (signedTxs.length > 0) {
        for (let index = 0; index < signedTxs.length; index++) {
            const signedtx = signedTxs[index];
            // const hashes = await connection.simulateTransaction(signedtx);
            const hashes = await connection.sendRawTransaction(signedtx.serialize(), {
                skipPreflight: !first,
            });
            console.log("hashes", hashes);
            // break
            hashs.push(hashes);
            console.log(index + " - " + hashes);
            // console.log(index, signedTxs.length - 1);

            if (first) {
                console.log("waitng for first transaction to be confirmed ...");
                const confTxData = await connection.confirmTransaction({
                    signature: hashes,
                    ...(await connection.getLatestBlockhash()),
                });
                first = false;
                Data.toBuy.atlas.atlas.hash = hashes;
                if (!!confTxData.value.err) {
                    console.log("error sending transaction", hashes);
                    throw `error sending transaction ${hashes}`;
                } else {
                    await delay(500);
                    console.log("validated!");
                }
            } else if (index == signedTxs.length - 1 * hasFees) {
                for (const key in Data.toBuy.atlas.fees) {
                    Data.toBuy.atlas.fees[key].hash = hashes;
                }
            } else {
                if (Data.toBuy.gMListToBuy.length >= index)
                    Data.toBuy.gMListToBuy[index - 1].hash = hashes;

                // if (signedTxs.length % 2 === 1) {
                //     console.log("index", 2 * (index - 1) + 1, "exists");

                //     toBuy.gMListToBuy[2 * (index - 1) + 1].hash = hashes;
                // } else {
                //     console.log("index", 2 * (index - 1) + 1, "does not exist exists");
                // }
            }
        }
    }

    console.log("toBuy", Data.toBuy);
    let latestBcData = await connection.getLatestBlockhash();
    console.log("Initialization of Transaction verifiation");

    const validhahs = await Promise.all(
        hashs.map(async (hash) => {
            return {
                confirmData: await connection.confirmTransaction({
                    signature: hash,
                    ...latestBcData,
                }),
                hash,
            };
        })
    );
    validhahs.forEach((valid) => {
        console.log("validatinng", valid.hash, " ...");

        if (!!valid.confirmData.value.err)
            throw `error sending transaction${valid.hash} \nthrough ${validhahs}`;
    });
    console.log("all Transactions validated");

    return Data.toBuy;
};

const ix2vTx = async (
    ixs: TransactionInstruction[][],
    signer: PublicKey,
    connection: Connection
): Promise<VersionedTransaction[]> => {
    let txs: Transaction[] = [];
    let maxSize = 1;
    let count = maxSize;
    for (let index = 0; index < ixs.length; index++) {
        const ix = ixs[index];
        if (count >= maxSize) {
            console.log("new", count);

            txs.push(new Transaction().add(...ix));
            count = 1;
        } else {
            console.log("added", count);
            txs[txs.length - 1].add(...ix);
            count++;
        }
    }
    console.log("txs", txs);

    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return txs.map((tx) => {
        // let tx = new Transaction();
        // tx.add(ix);
        tx.feePayer = signer;
        tx.recentBlockhash = recentBlockhash;

        return new VersionedTransaction(tx.compileMessage());
    });
};

export async function getPriceGM(list: InOutAtlasBundle["gMListToBuy"]) {}
