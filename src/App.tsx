import { Tabs, Tab } from 'react-bootstrap';
import { useState } from 'react';

import 'bootstrap/dist/css/bootstrap.min.css';

import Game2048 from './Game2048/Game2048';
import Othello from './Othello/Othello';
import OneStrokePuzzle from './OneStroke/OneStroke';

export default function App() {
  const [activeTab, setActiveTab] = useState("game2048");
  const [lockString, setLockString] = useState(undefined as string | undefined);

  return (
    <>
      {/* modal-backdrop を画面全体に表示 */}
      {lockString && (
        <div
          className="modal-backdrop fade show"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            fontSize: "2rem",
            textShadow: "0 0 5px black",
          }}
        >
          <div>{lockString ?? ""}</div>
        </div>
      )}
      
      <div className="container mt-4">
        <Tabs id="uncontrolled-tab-example" className="mb-3" activeKey={activeTab} onSelect={(k) => setActiveTab(k || "")}>
          <Tab eventKey="game2048" title="2048">
            <Game2048 isActive={activeTab === "game2048"} />
          </Tab>
          <Tab eventKey="othello" title="オセロ">
            <Othello setLockString={setLockString} />
          </Tab>
          <Tab eventKey="oneStroke" title="一筆書き">
            <OneStrokePuzzle />
          </Tab>
        </Tabs>
      </div>
    </>
  )
}
