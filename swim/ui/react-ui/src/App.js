import React, { useState, useEffect, useRef } from "react";
import PageHeader from "./Components/Views/Layout/PageHeader";
import PerspectiveView from "./Components/Views/PerspectiveView";
import FlatView from "./Components/Views/FlatView";
import NeonView from "./Components/Views/NeonView";
import SideMenu from "./Components/Menus/SideMenu";
import SatelliteView from "./Components/Views/SatelliteView";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import * as swim from "@swim/system";
import './Components/Views/Helpers/layoutPlugin'

function App() {
    const satelliteList = useRef({});
    const [dataLink, setDataLink] = useState(null);
    const [state, setState] = useState({
      loading: true,
      satellites: {},
      selectedSatellite: null
    })
    const updateTimeout = useRef(null);

    useEffect(() => {

      if (dataLink === null) {
        const newlink = swim.nodeRef(`warp://127.0.0.1:9001`, 'aggregation').downlinkMap().laneUri('satelliteList')
          // when an new item is added to the list, append it to listItems
          .didUpdate((key, newValue) => {
            // console.info(state.loading);
            satelliteList.current[key.stringValue()] = newValue;
            satelliteList.current[key.stringValue()].dirty = true;
            if(updateTimeout.current !== null) {
              clearTimeout(updateTimeout.current)
            }
            updateTimeout.current = setTimeout(() => {
              // if(state.loading === false) {
                console.info('dataset updated');
                setState({
                  ...state,
                  loading: false,
                  satellites: {...satelliteList.current}
                });
              // }
            }, 200);
          })
          .didSync(() => {
            console.info('synced');
            setState({
              ...state,
              loading: false,
              satellites: {...satelliteList.current}
            });
            
          })
          .open();         
          
          setDataLink(newlink);    
      }


      return () => {
          if (dataLink !== null) {
              // dataLink.close();
          }
      };
    }, [dataLink, state]);

    
    function selectSat(satelliteId) {
      setState({
        ...state,
        loading: false,
        satellites: {...satelliteList.current},
        selectedSatellite: satelliteId
      });

    }

    return (
        <div className="main">
            <PageHeader title="Satellites" subTitle="Swim+Kafka+React" />
            <Router>
                <SideMenu />
                <Switch>
                    <Route exact path="/">
                        <FlatView state={state} />
                    </Route>
                    <Route path="/3dmap">
                        <PerspectiveView state={state} />
                    </Route>
                    <Route path="/neon">
                        <NeonView state={state} />
                    </Route>
                    <Route path="/satellite/:id">
                        <SatelliteView />
                    </Route>
                </Switch>

            </Router>
        </div>
    );
}

export default App;
