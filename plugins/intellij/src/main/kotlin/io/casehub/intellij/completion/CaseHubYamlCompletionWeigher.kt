package io.casehub.intellij.completion

import com.intellij.codeInsight.completion.CompletionLocation
import com.intellij.codeInsight.completion.CompletionWeigher
import com.intellij.codeInsight.lookup.LookupElement

class CaseHubYamlCompletionWeigher : CompletionWeigher() {

    override fun weigh(element: LookupElement, location: CompletionLocation): Comparable<*> {
        val file = location.completionParameters.originalFile.virtualFile ?: return 0
        val name = file.name
        if (!name.endsWith(".page.yaml") && !name.endsWith(".dash.yaml")) return 0
        val s = element.lookupString
        if (s == "{}" || s == "[]") return -1
        return 0
    }
}
