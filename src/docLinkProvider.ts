import * as vscode from "vscode";
import { LanguageClient, CancellationToken } from "vscode-languageclient";

export class DocumentLinkProvider implements vscode.DocumentLinkProvider {
  /**
   * Handles creation of document links (https://code.visualstudio.com/api/references/vscode-api#DocumentLink)
   * for doc roles. Clicking on the target of a document link allows the user to open a text editor with its
   * corresponding file.
   */

  private _client: LanguageClient;

  constructor(client: LanguageClient) {
    this._client = client;
  }

  // Provides the text document with the ranges for document links
  provideDocumentLinks(
    document: vscode.TextDocument,
    token: CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    return this._findDocLinks(document);
  }

  // Adds the target uri to the document link
  async resolveDocumentLink(
    link: vscode.DocumentLink,
    token: CancellationToken
  ): Promise<vscode.DocumentLink> {
    const document = vscode.window.activeTextEditor.document;
    const text = document.getText(link.range);
    link.target = await this._findTargetUri(document, text);
    return link;
  }

  // Returns document links found within the current text document
  private _findDocLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
    const docText = document.getText();
    const docRoles = docText.match(/:doc:`.+?`/gs);

    if (docRoles === null) return [];

    let doclinks: vscode.DocumentLink[] = [];
    let docRoleOffsetStart = -1; // Initiated to -1 to accommodate 0th index

    // For every doc role found, find their respective target
    for (const docRole of docRoles) {
      docRoleOffsetStart = docText.indexOf(docRole, docRoleOffsetStart + 1);

      // Find target in doc role
      // Check if target exists in the form :doc:`text <target-name>`
      let targetMatches = docRole.match(/(?<=<)\S+(?=>)/);
      // If target not found, target should exist in the form :doc:`target-name`
      if (targetMatches === null) {
        targetMatches = docRole.match(/(?<=`)\S+(?=`)/);
      }
      const target = targetMatches[0];
      const targetIndex = docRole.indexOf(target);

      // Get range of the target within the scope of the whole text document
      const targetOffsetStart = docRoleOffsetStart + targetIndex;
      const targetOffsetEnd = targetOffsetStart + target.length;

      doclinks.push({
        range: new vscode.Range(
          document.positionAt(targetOffsetStart),
          document.positionAt(targetOffsetEnd)
        )
      });
    }

    return doclinks;
  }

  // Returns the full uri given a target's name
  private async _findTargetUri(
    document: vscode.TextDocument,
    target: string
  ): Promise<vscode.Uri> {
    return await this._client
      .sendRequest("textDocument/resolve", {
        fileName: target,
        docPath: document.uri.path,
        resolveType: "doc"
      })
      .then((file: string) => {
        return vscode.Uri.file(file);
      });
  }
}
