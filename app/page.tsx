"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import { useState } from "react";
import Bundle from "./_components/Bundle";
import { stateToBuy } from "./services/utils";
import { getStarAtlasBundle } from "./services/starAtlas";

export default function Home() {
    const [state, setState] = useState({});
    const { connected, publicKey, wallet } = useWallet();

    const setOrderQuantity = (data: { [itemId: string]: number }) => {
        setState({ ...state, ...data });
    };

    const handleSubmit = async () => {
        if (!publicKey || !wallet) throw "";
        // console.log(state);

        if (Object.keys(state).length === 0) {
            alert("no item selected");
            throw "no item selected";
        }
        const toBuy = stateToBuy(state);

        console.log("toBuy", toBuy);
        //@ts-ignore
        const res = await getStarAtlasBundle({ user: publicKey, wallet: wallet.adapter, toBuy });
        console.log(res);
        return res;
    };

    return (
        <main className="flex min-h-screen flex-col items-center p-24 gap-5">
            <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex">
                <a
                    className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
                    href="https://neoswap.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Image src="/smallLogo.svg" alt="Neoswap" width={100} height={24} priority />
                </a>
            </div>
            <div>
                <WalletMultiButton />
            </div>
            {connected && (
                <Bundle
                    setOrderQuantity={setOrderQuantity}
                    handleSubmit={handleSubmit}
                    orderQuantity={state}
                />
            )}
        </main>
    );
}
