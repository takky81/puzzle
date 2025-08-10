import { Tabs, Tab } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import OneStrokePuzzle from './OneStroke/OneStroke';
import Game2048 from './Game2048/Game2048';
import { useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState("game2048");

  return (
    <div className="container mt-4">
      <Tabs id="uncontrolled-tab-example" className="mb-3" activeKey={activeTab} onSelect={(k) => setActiveTab(k || "")}>
        <Tab eventKey="game2048" title="2048">
          <Game2048 isActive={activeTab === "game2048"} />
        </Tab>
        <Tab eventKey="oneStroke" title="一筆書き">
          <OneStrokePuzzle />
        </Tab>
      </Tabs>
    </div>
  )
}
