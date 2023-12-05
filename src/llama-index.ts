// example.ts
import { Document, VectorStoreIndex } from "llamaindex";
import * as dotenv from 'dotenv';

dotenv.config();

const testBlock = "Tezos Documentation PortalWelcome to the Tezos Documentation Portal. We're currently in beta. Please share your feedback to help us improve. Tezos Blockchain Overview Understanding what makes Tezos different and what you need to start buildingTutorialSmart RollupsGet started by deploying your own smart rollup with our onboarding tutorialTezos BasicsGet and Install TezosGet started with the Tezos client, OctezTutorialOriginate your First Smart ContractHow to originate your first smart contractTezos Protocol & ShellUnderstanding the Tezos Protocol & ShellTest NetworksGet started with testnetsSmart Contract LanguagesFind out which language is for youDeFi, NFTs and GamingDecentralised Exchanges Learn about a fundamental DeFi use caseCreate an NFTCreate your own NFT smart contractTutorialBuild an NFT MarketplaceBuild a full marketplace from scratchTezos SDK for UnityRead about our SDK for UnityComing SoonBuild a Game on TezosBuild a game on Tezos from scratchApp DevelopmentTutorialBuild your first appBuild an app from scratchTaquitoGet started with Taquito in JS/TSIndexersFind out about the importance of indexersWallets and Beacon SDKLearn about wal"

async function main() {
  // Create Document object with essay
  const document = new Document({ text: testBlock });

  // Split text and create embeddings. Store them in a VectorStoreIndex
  const index = await VectorStoreIndex.fromDocuments([document]);

  // Query the index
  const queryEngine = index.asQueryEngine();
  const response = await queryEngine.query(
    "What can I learn from tezos documentation portal"
  );

  // Output response
  console.log(response.toString());
}

main();