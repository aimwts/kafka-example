import React from "react";

function Loader(props) {
    return (
        <div className="absolute w-full h-full text-center ">
            <div className="lds-ellipsis ">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            <div className="flex justify-center">
                <div>Loading Satellites</div>
            </div>
        </div>
    );
}

export default Loader;
