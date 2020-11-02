import React, {useState, useEffect} from 'react';
import * as swimClient from "@swim/client";
import { useParams } from 'react-router-dom';
import Loader from './Layout/Loader';

function SatelliteView(props) {
    const { id } = useParams();
    const swimUrl = "warp://127.0.0.1:9001";
    const [satellite, setSatellite] = useState(null);
    const [dataLink, setDataLink] = useState(null);

    let content = <Loader />;

    if(satellite !== null) {
        const dataKeys = Object.keys(satellite.toObject());
        // console.info(dataKeys);
        content = dataKeys.map((key) => 
            <div> {key}: {satellite.get(key).stringValue()}</div>
        );
        
    }

    useEffect(() => { 
        function handleDataChange(newData){
            setSatellite(newData);
        }

        if(dataLink === null) {
            const newlink = swimClient.nodeRef(swimUrl, `satellite/${id}`).downlinkValue().laneUri('fullRowData')
                .didSet((newValue, oldValue) => {
                    handleDataChange(newValue);
                })
                .open(); 
            setDataLink(newlink, id);
        }

        return () => {
            if(dataLink !== null) {
                // dataLink.close();
            }
        }

    }, [dataLink, id])

    return (
        <div className="perspectiveViewMain bg-grey-200 w-full text-center">
            { content }
        </div>
    )
}

export default SatelliteView;