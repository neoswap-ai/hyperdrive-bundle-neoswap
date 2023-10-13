import Image from "next/image";
import { data } from "../_data";

export default function Bundle({
  handleSubmit,
  setOrderQuantity,
  orderQuantity,
}: {
  handleSubmit: () => void;
  setOrderQuantity: (data: any) => void;
  orderQuantity: { [itemId: string]: number };
}) {
  return (
    <div className="w-full flex flex-col gap-10">
      <div className="flex flex-row w-full rounded-2xl p-2 gap-4 flex-wrap justify-center">
        {data.map((ele) => {
          return (
            <div
              key={`give_${ele.itemId}_panel`}
              className="flex-col justify-start items-start gap-2 inline-flex w-1/2 sm:w-1/3 md:w-60"
            >
              <div className="bg-white rounded-2xl border-b-2 border-red-500 justify-center items-center inline-flex overflow-hidden">
                <div className="relative">
                  <div className="absolute bg-[#0F151B] rounded-lg text-white bottom-3 left-3 p-2 flex gap-2">
                    <span className="text-xs font-normal leading-3">
                      Quantity
                    </span>
                    <span className="text-white text-sm font-bold leading-3">
                      {ele.quantity.toLocaleString()}
                    </span>
                  </div>
                  <img src={ele.thumbnail} alt={ele.name} className="w-full" />
                </div>
              </div>
              <div className="px-3 py-[10.58px] flex-col justify-start items-start gap-2 flex w-full">
                <div className="self-stretch text-white text-[13.885246276855469px] font-bold leading-tight">
                  {ele.name}
                </div>
                <div className="self-stretch justify-start items-start gap-[6.61px] inline-flex">
                  <div className="grow shrink basis-0 text-white text-[10.579235076904297px] font-normal">
                    {ele.collection.collection}
                  </div>
                  <div className="text-right text-red-600 text-[10.579235076904297px] font-normal">
                    <div
                      role="button"
                      className="text-white text-[10.579235076904297px]"
                    >
                      <a target="_blank" href={ele.marketplace.url}>
                        View more details
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="justify-center">
                <label
                  className="block text-white text-sm font-bold mb-2"
                  htmlFor={`quantity_${ele.itemId}`}
                >
                  Quantity
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                  id={`quantity_${ele.itemId}`}
                  type="number"
                  placeholder="0"
                  value={orderQuantity[ele.itemId] || 0}
                  onChange={(e) => {
                    setOrderQuantity({ [ele.itemId]: e.target.value });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex w-full justify-center">
        <button
          onClick={handleSubmit}
          className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-4 px-6 border border-blue-500 hover:border-transparent rounded"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
